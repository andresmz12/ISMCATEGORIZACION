import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tokensToCents, estimateTransactionLimit } from '@/lib/ai-pricing'
import { getBusinessAccountId } from '@/lib/account'

export { tokensToCents, estimateTransactionLimit }

const BUDGET_MESSAGE =
  'Tu cuenta alcanzó su presupuesto mensual de clasificación con IA. Contacta a tu administrador para aumentar el límite.'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

// Checks whether the account that owns this business has exceeded its
// configured monthly AI budget. The budget is shared across every business
// the account owns, not scoped to just this one. Returns a 403 response if
// blocked, otherwise null.
export async function checkAiBudget(businessId: string): Promise<NextResponse | null> {
  const accountId = await getBusinessAccountId(businessId)
  // Fail closed: a business with no resolvable owning account is a data
  // integrity problem (see lib/account.ts), not evidence of "no budget
  // configured" — the old per-business check could never hit this case
  // since the budget lived directly on Business, which always exists.
  // Letting it through here would mean unmetered, unblockable AI spend.
  if (!accountId) {
    return NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 })
  }

  const account = await prisma.billingAccount.findUnique({
    where: { id: accountId },
    select: { aiMonthlyBudgetCents: true },
  })
  // null/undefined = no budget configured (unlimited). A budget of exactly 0
  // is a valid "fully blocked" setting and must not be treated as unlimited.
  if (account?.aiMonthlyBudgetCents == null) return null

  const usage = await prisma.aiUsage.findUnique({
    where: { accountId_period: { accountId, period: currentPeriod() } },
  })
  // A $0 budget blocks immediately, even before any AiUsage row exists yet
  // (e.g. a brand-new account never used AI this period).
  if (account.aiMonthlyBudgetCents === 0 && !usage?.unblockedByAdmin) {
    return NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 })
  }
  if (!usage) return null

  if (usage.blocked && !usage.unblockedByAdmin) {
    return NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 })
  }
  return null
}

// Records token usage/cost against the account that owns this business, for
// the account's current billing period, and flags it as blocked once its
// configured budget is exceeded.
export async function recordAiUsage(
  businessId: string,
  inputTokens: number,
  outputTokens: number,
  classifiedCount = 0
): Promise<void> {
  if (inputTokens <= 0 && outputTokens <= 0) return
  const accountId = await getBusinessAccountId(businessId)
  if (!accountId) return // no owner found (shouldn't happen) — nothing to attribute usage to

  const costCents = tokensToCents(inputTokens, outputTokens)
  const period = currentPeriod()

  const usage = await prisma.aiUsage.upsert({
    where: { accountId_period: { accountId, period } },
    create: { accountId, period, inputTokens, outputTokens, costCents, classifiedCount },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      costCents: { increment: costCents },
      classifiedCount: { increment: classifiedCount },
    },
  })

  const account = await prisma.billingAccount.findUnique({
    where: { id: accountId },
    select: { aiMonthlyBudgetCents: true },
  })
  if (account?.aiMonthlyBudgetCents != null && usage.costCents >= account.aiMonthlyBudgetCents && !usage.blocked) {
    await prisma.aiUsage.update({ where: { id: usage.id }, data: { blocked: true } })
  }
}

// Transaction-count summary for an account's own users (never exposes cost/budget in $).
// `limit` is the admin-configured $ budget translated into an estimated
// transaction count, or null if unlimited.
export async function getAccountClassifiedCount(
  accountId: string
): Promise<{ classifiedCount: number; limit: number | null; period: string }> {
  const period = currentPeriod()
  const [usage, account] = await Promise.all([
    prisma.aiUsage.findUnique({ where: { accountId_period: { accountId, period } }, select: { classifiedCount: true } }),
    prisma.billingAccount.findUnique({ where: { id: accountId }, select: { aiMonthlyBudgetCents: true } }),
  ])
  return {
    classifiedCount: usage?.classifiedCount ?? 0,
    limit: estimateTransactionLimit(account?.aiMonthlyBudgetCents),
    period,
  }
}

// Same as above, but resolved from a business rather than an already-known
// accountId — this reflects the whole account's usage this period (shared
// across every business the account owns), not just this one business.
export async function getClassifiedCount(
  businessId: string
): Promise<{ classifiedCount: number; limit: number | null; period: string }> {
  const accountId = await getBusinessAccountId(businessId)
  if (!accountId) return { classifiedCount: 0, limit: null, period: currentPeriod() }
  return getAccountClassifiedCount(accountId)
}
