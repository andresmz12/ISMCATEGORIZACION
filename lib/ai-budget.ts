import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tokensToCents, estimateTransactionLimit } from '@/lib/ai-pricing'

export { tokensToCents, estimateTransactionLimit }

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

// Checks whether a business has exceeded its configured monthly AI budget.
// Returns a 403 response if blocked, otherwise null.
export async function checkAiBudget(businessId: string): Promise<NextResponse | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { aiMonthlyBudgetCents: true },
  })
  // null/undefined = no budget configured (unlimited). A budget of exactly 0
  // is a valid "fully blocked" setting and must not be treated as unlimited.
  if (business?.aiMonthlyBudgetCents == null) return null

  const usage = await prisma.aiUsage.findUnique({
    where: { businessId_period: { businessId, period: currentPeriod() } },
  })
  // A $0 budget blocks immediately, even before any AiUsage row exists yet
  // (e.g. a brand-new business never used AI this period).
  if (business.aiMonthlyBudgetCents === 0 && !usage?.unblockedByAdmin) {
    return NextResponse.json(
      {
        error:
          'Este negocio alcanzó su presupuesto mensual de clasificación con IA. Contacta a tu administrador para aumentar el límite.',
      },
      { status: 403 }
    )
  }
  if (!usage) return null

  if (usage.blocked && !usage.unblockedByAdmin) {
    return NextResponse.json(
      {
        error:
          'Este negocio alcanzó su presupuesto mensual de clasificación con IA. Contacta a tu administrador para aumentar el límite.',
      },
      { status: 403 }
    )
  }
  return null
}

// Records token usage/cost for a business's current billing period and
// flags it as blocked once its configured budget is exceeded.
export async function recordAiUsage(
  businessId: string,
  inputTokens: number,
  outputTokens: number,
  classifiedCount = 0
): Promise<void> {
  if (inputTokens <= 0 && outputTokens <= 0) return
  const costCents = tokensToCents(inputTokens, outputTokens)
  const period = currentPeriod()

  const usage = await prisma.aiUsage.upsert({
    where: { businessId_period: { businessId, period } },
    create: { businessId, period, inputTokens, outputTokens, costCents, classifiedCount },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      costCents: { increment: costCents },
      classifiedCount: { increment: classifiedCount },
    },
  })

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { aiMonthlyBudgetCents: true },
  })
  if (business?.aiMonthlyBudgetCents != null && usage.costCents >= business.aiMonthlyBudgetCents && !usage.blocked) {
    await prisma.aiUsage.update({ where: { id: usage.id }, data: { blocked: true } })
  }
}

// Transaction-count summary for the business's own users (never exposes cost/budget in $).
// `limit` is the admin-configured $ budget translated into an estimated transaction
// count, or null if the business has no budget configured (unlimited).
export async function getClassifiedCount(
  businessId: string
): Promise<{ classifiedCount: number; limit: number | null; period: string }> {
  const period = currentPeriod()
  const [usage, business] = await Promise.all([
    prisma.aiUsage.findUnique({ where: { businessId_period: { businessId, period } }, select: { classifiedCount: true } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { aiMonthlyBudgetCents: true } }),
  ])
  return {
    classifiedCount: usage?.classifiedCount ?? 0,
    limit: estimateTransactionLimit(business?.aiMonthlyBudgetCents),
    period,
  }
}
