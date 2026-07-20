import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { square, getSquareLocationId } from '@/lib/square'
import { isPaidPlan, getSquarePlanVariationId, SQUARE_PAID_PLANS } from '@/lib/square-plans'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Starts a Square-hosted subscription checkout for the caller's BillingAccount.
// We can't pass our own reference id through Square's subscription-checkout
// shortcut (checkout_options.subscription_plan_id), so instead we remember
// the order_id CreatePaymentLink hands back synchronously — the webhook
// handler matches on that when the first invoice payment comes in.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountId = (session.user as any).accountId
  const accountRole = (session.user as any).accountRole
  if (accountRole !== 'OWNER') {
    return NextResponse.json({ error: 'Solo el dueño de la cuenta puede cambiar el plan de facturación' }, { status: 403 })
  }

  const rl = rateLimit(`square-checkout:${accountId}`, 10, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const plan = body?.plan
  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: 'Plan inválido — debe ser PLUS o ENTERPRISE' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const appUrl = process.env.NEXTAUTH_URL || 'https://myprofitandloss.com'
  const { priceCents } = SQUARE_PAID_PLANS[plan]

  try {
    const response = await square.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      quickPay: {
        name: `Plan ${plan} — myprofitandloss.com`,
        priceMoney: { amount: BigInt(priceCents), currency: 'USD' },
        locationId: getSquareLocationId(),
      },
      checkoutOptions: {
        subscriptionPlanId: getSquarePlanVariationId(plan),
        redirectUrl: `${appUrl}/settings?checkout=complete`,
      },
      prePopulatedData: user?.email ? { buyerEmail: user.email } : undefined,
    })

    if (response.errors?.length) {
      console.error('square checkout errors:', response.errors)
      return NextResponse.json({ error: 'No se pudo iniciar el checkout de Square' }, { status: 502 })
    }

    const paymentLink = response.paymentLink
    if (!paymentLink?.url || !paymentLink.orderId) {
      console.error('square checkout: missing url/orderId in response', response)
      return NextResponse.json({ error: 'No se pudo iniciar el checkout de Square' }, { status: 502 })
    }

    await prisma.billingAccount.update({
      where: { id: accountId },
      data: { pendingSquareOrderId: paymentLink.orderId, pendingSquarePlan: plan },
    })

    return NextResponse.json({ url: paymentLink.url })
  } catch (err: any) {
    console.error('square checkout error:', err)
    return NextResponse.json({ error: 'No se pudo iniciar el checkout de Square' }, { status: 500 })
  }
}
