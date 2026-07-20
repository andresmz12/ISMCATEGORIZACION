import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { square } from '@/lib/square'
import { isPaidPlan, getSquarePlanVariationId } from '@/lib/square-plans'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Square has no self-service billing portal, so cancel/resume/swap are our
// own authenticated endpoints that call the Subscriptions API directly.
// These are all *scheduled* actions on Square's side (they take effect at
// the end of the current billing period, not instantly) — we don't flip
// BillingAccount.plan/subscriptionStatus here, we wait for the resulting
// subscription.updated webhook so the DB always reflects what Square
// actually did rather than what we merely asked for.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = (session.user as any).accountId
  const accountRole = (session.user as any).accountRole
  if (accountRole !== 'OWNER') {
    return NextResponse.json({ error: 'Solo el dueño de la cuenta puede administrar la suscripción' }, { status: 403 })
  }

  const rl = rateLimit(`square-manage:${accountId}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const action = body?.action

  const account = await prisma.billingAccount.findUnique({ where: { id: accountId }, select: { squareSubscriptionId: true } })
  if (!account?.squareSubscriptionId) {
    return NextResponse.json({ error: 'Esta cuenta no tiene una suscripción activa en Square' }, { status: 400 })
  }
  const subscriptionId = account.squareSubscriptionId

  try {
    if (action === 'cancel') {
      await square.subscriptions.cancel({ subscriptionId })
      return NextResponse.json({ ok: true, message: 'La suscripción se cancelará al final del periodo actual' })
    }

    if (action === 'resume') {
      await square.subscriptions.resume({ subscriptionId })
      return NextResponse.json({ ok: true, message: 'La suscripción se reanudará' })
    }

    if (action === 'swap') {
      const plan = body?.plan
      if (!isPaidPlan(plan)) return NextResponse.json({ error: 'Plan inválido — debe ser PLUS o ENTERPRISE' }, { status: 400 })
      await square.subscriptions.swapPlan({ subscriptionId, newPlanVariationId: getSquarePlanVariationId(plan) })
      return NextResponse.json({ ok: true, message: `El cambio a ${plan} se aplicará en el próximo ciclo de facturación` })
    }

    return NextResponse.json({ error: 'Acción inválida — debe ser cancel, resume o swap' }, { status: 400 })
  } catch (err: any) {
    console.error('square manage error:', err)
    return NextResponse.json({ error: 'No se pudo completar la solicitud con Square' }, { status: 500 })
  }
}
