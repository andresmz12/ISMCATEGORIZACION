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

// A $0 budget blocks immediately, even before any AiUsage row exists yet
// (e.g. a brand-new account never used AI this period). null/undefined
// budget = no budget configured (unlimited).
function isBudgetBlocked(
  usage: { blocked: boolean; unblockedByAdmin: boolean } | null | undefined,
  budgetCents: number | null | undefined
): boolean {
  if (budgetCents == null) return false
  if (budgetCents === 0) return !usage?.unblockedByAdmin
  if (!usage) return false
  return usage.blocked && !usage.unblockedByAdmin
}

// Read-only budget check for callers that just need current status (e.g. a
// pre-flight UI check) without gating an actual AI call — for anything that
// actually calls the Anthropic API, use withAiBudget() instead, which closes
// the TOCTOU race this function alone can't: two concurrent requests can
// both call checkAiBudget and both pass before either records its spend.
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
  const usage = await prisma.aiUsage.findUnique({
    where: { accountId_period: { accountId, period: currentPeriod() } },
  })
  return isBudgetBlocked(usage, account?.aiMonthlyBudgetCents) ? NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 }) : null
}

// Runs `fn` (an Anthropic call plus whatever else needs the resulting tokens)
// gated by the account's AI budget, with the check-then-spend sequence made
// atomic: checkAiBudget() and recordAiUsage() used to be two separate,
// non-locked steps, so concurrent requests for the same account (multiple
// tabs, or classify-ai + receipts/scan + chat firing together) could all
// pass the check before any of them recorded cost, letting the account
// overshoot its budget by roughly N× one request's cost. A Postgres
// transaction-scoped advisory lock keyed on the account serializes the
// check+call+record sequence per account (auto-released on commit/rollback,
// so it can never leak even if `fn` throws or the connection drops) — the
// cost is that concurrent AI requests for the same account queue up instead
// of running in parallel, which is the right tradeoff for a hard budget cap.
export async function withAiBudget<T>(
  businessId: string,
  fn: () => Promise<{ result: T; inputTokens: number; outputTokens: number; classifiedCount?: number }>
): Promise<{ ok: true; result: T } | { ok: false; response: NextResponse }> {
  const accountId = await getBusinessAccountId(businessId)
  if (!accountId) {
    return { ok: false, response: NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 }) }
  }

  let outcome!: { ok: true; result: T } | { ok: false; response: NextResponse }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`

    const period = currentPeriod()
    const [account, usage] = await Promise.all([
      tx.billingAccount.findUnique({ where: { id: accountId }, select: { aiMonthlyBudgetCents: true } }),
      tx.aiUsage.findUnique({ where: { accountId_period: { accountId, period } } }),
    ])
    const budget = account?.aiMonthlyBudgetCents

    if (isBudgetBlocked(usage, budget)) {
      outcome = { ok: false, response: NextResponse.json({ error: BUDGET_MESSAGE }, { status: 403 }) }
      return
    }

    const { result, inputTokens, outputTokens, classifiedCount = 0 } = await fn()

    if (inputTokens > 0 || outputTokens > 0) {
      const costCents = tokensToCents(inputTokens, outputTokens)
      const updated = await tx.aiUsage.upsert({
        where: { accountId_period: { accountId, period } },
        create: { accountId, period, inputTokens, outputTokens, costCents, classifiedCount },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          costCents: { increment: costCents },
          classifiedCount: { increment: classifiedCount },
        },
      })
      if (budget != null && updated.costCents >= budget && !updated.blocked) {
        await tx.aiUsage.update({ where: { id: updated.id }, data: { blocked: true } })
      }
    }

    outcome = { ok: true, result }
  }, { timeout: 120_000, maxWait: 10_000 })

  return outcome
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
