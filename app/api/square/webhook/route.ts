import { NextResponse } from 'next/server'
import { WebhooksHelper, serialization } from 'square'
import type { InvoicePaymentMadeEvent, InvoiceScheduledChargeFailedEvent, SubscriptionUpdatedEvent } from 'square'
import { prisma } from '@/lib/prisma'
import { getSquareWebhookConfig } from '@/lib/square'
import { planFromVariationId } from '@/lib/square-plans'

// Square signs the raw body together with the exact notification URL, so we
// must read the body as text (no JSON parsing/mutation before verification)
// and never trust the payload until verifySignature returns true.
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-square-hmacsha256-signature') || ''

  let signatureKey: string, notificationUrl: string
  try {
    ;({ signatureKey, notificationUrl } = getSquareWebhookConfig())
  } catch (err: any) {
    console.error('square webhook config missing:', err.message)
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const valid = await WebhooksHelper.verifySignature({ requestBody: rawBody, signatureHeader, signatureKey, notificationUrl })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let envelope: any
  try {
    envelope = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  switch (envelope?.type) {
    case 'invoice.payment_made': {
      const parsed = serialization.InvoicePaymentMadeEvent.parse(envelope)
      if (!parsed.ok) { console.error('square webhook: invoice.payment_made parse error', parsed.errors); break }
      await handleInvoicePaymentMade(parsed.value)
      break
    }
    case 'invoice.scheduled_charge_failed': {
      const parsed = serialization.InvoiceScheduledChargeFailedEvent.parse(envelope)
      if (!parsed.ok) { console.error('square webhook: invoice.scheduled_charge_failed parse error', parsed.errors); break }
      await handleInvoiceChargeFailed(parsed.value)
      break
    }
    case 'subscription.updated': {
      const parsed = serialization.SubscriptionUpdatedEvent.parse(envelope)
      if (!parsed.ok) { console.error('square webhook: subscription.updated parse error', parsed.errors); break }
      await handleSubscriptionUpdated(parsed.value)
      break
    }
    default:
      // subscription.created, invoice.created/updated, etc. — nothing to act on.
      break
  }

  return NextResponse.json({ ok: true })
}

// Default monthly AI budget auto-granted the first time an account reaches
// a paid tier that includes AI classification — the accountant doesn't have
// to know to configure this themselves, and an admin can still raise/lower
// it afterward (both call sites below only apply this when nothing's set yet).
const DEFAULT_AI_BUDGET_CENTS: Partial<Record<'PLUS' | 'ENTERPRISE', number>> = {
  PLUS: 700,        // $7/mo (~19,400 AI-classified transactions/month, estimated)
  ENTERPRISE: 1500,  // $15/mo (~41,600 AI-classified transactions/month, estimated)
}

async function handleInvoicePaymentMade(event: InvoicePaymentMadeEvent) {
  const invoice = event.data?.object?.invoice
  const orderId = invoice?.orderId
  const subscriptionId = invoice?.subscriptionId
  if (!subscriptionId) return

  // First payment for a brand-new subscription: match by the order_id we
  // stashed when creating the checkout link, then activate the plan we
  // requested at that time.
  if (orderId) {
    const pending = await prisma.billingAccount.findUnique({ where: { pendingSquareOrderId: orderId } })
    if (pending) {
      const activatedPlan = pending.pendingSquarePlan ?? pending.plan
      // Grant the default AI budget for this tier — but never clobber one
      // that's somehow already set (e.g. an admin pre-configured it before
      // checkout completed).
      const defaultBudget = DEFAULT_AI_BUDGET_CENTS[activatedPlan as 'PLUS' | 'ENTERPRISE']
      await prisma.billingAccount.update({
        where: { id: pending.id },
        data: {
          plan: activatedPlan,
          squareSubscriptionId: subscriptionId,
          subscriptionStatus: 'ACTIVE',
          pendingSquareOrderId: null,
          pendingSquarePlan: null,
          ...(defaultBudget != null && pending.aiMonthlyBudgetCents == null ? { aiMonthlyBudgetCents: defaultBudget } : {}),
        },
      })
      return
    }
  }

  // Recurring renewal payment for an already-linked subscription — confirm
  // the account is in good standing (clears any prior PAYMENT_FAILED flag).
  const result = await prisma.billingAccount.updateMany({
    where: { squareSubscriptionId: subscriptionId },
    data: { subscriptionStatus: 'ACTIVE' },
  })
  if (result.count === 0) {
    // A real payment came in and we couldn't attach it to any account —
    // this needs a human to reconcile, not a silent drop.
    console.error(`square webhook: invoice.payment_made for subscription ${subscriptionId} (order ${orderId}) matched no BillingAccount`)
  }
}

async function handleInvoiceChargeFailed(event: InvoiceScheduledChargeFailedEvent) {
  const subscriptionId = event.data?.object?.invoice?.subscriptionId
  if (!subscriptionId) return

  const result = await prisma.billingAccount.updateMany({
    where: { squareSubscriptionId: subscriptionId },
    data: { subscriptionStatus: 'PAYMENT_FAILED' },
  })
  if (result.count === 0) {
    console.error(`square webhook: invoice.scheduled_charge_failed for subscription ${subscriptionId} matched no BillingAccount`)
  }
}

async function handleSubscriptionUpdated(event: SubscriptionUpdatedEvent) {
  const subscription = event.data?.object?.subscription
  const subscriptionId = subscription?.id
  const status = subscription?.status
  if (!subscriptionId || !status) return

  const data: { subscriptionStatus: string; plan?: 'NONE' | 'BASIC' | 'PLUS' | 'ENTERPRISE' } = { subscriptionStatus: status }

  if (status === 'ACTIVE') {
    const plan = planFromVariationId(subscription.planVariationId)
    if (plan) data.plan = plan
  } else if (status === 'CANCELED' || status === 'DEACTIVATED' || status === 'COMPLETED' || status === 'PAUSED') {
    // Paid access ends the moment Square stops billing (or pauses billing)
    // for this subscription — back to NONE, not BASIC. BASIC is itself a
    // paid $20/mo tier, not a free fallback; resuming will flip the account
    // back via a later subscription.updated event with status ACTIVE.
    data.plan = 'NONE'
  }

  const defaultBudget = data.plan ? DEFAULT_AI_BUDGET_CENTS[data.plan as 'PLUS' | 'ENTERPRISE'] : undefined
  if (defaultBudget != null) {
    // Only grant the default if nothing's configured yet — never clobber an
    // admin's existing override (including a previous auto-grant) on a later
    // renewal/swap event for the same subscription.
    const account = await prisma.billingAccount.findUnique({
      where: { squareSubscriptionId: subscriptionId },
      select: { aiMonthlyBudgetCents: true },
    })
    if (account && account.aiMonthlyBudgetCents == null) {
      (data as any).aiMonthlyBudgetCents = defaultBudget
    }
  }

  await prisma.billingAccount.updateMany({
    where: { squareSubscriptionId: subscriptionId },
    data,
  })
}
