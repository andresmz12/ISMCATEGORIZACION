// Pure, dependency-free plan/trial resolution. Deliberately has zero
// imports (no Prisma) so it's safe to use from middleware.ts, which runs in
// the Edge runtime and can't load the Prisma Client.

export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function isTrialActive(trialEndsAt: string | Date | null | undefined): boolean {
  return !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now()
}

// The plan that should actually govern feature access right now. An account
// that hasn't paid (plan NONE) but is still within its signup trial window
// is treated as BASIC so new signups can use the app for the first 7 days
// before they have to pay. Everyone else's real plan governs as-is.
export function effectivePlan(plan: string, trialEndsAt: string | Date | null | undefined): string {
  if (plan === 'NONE' && isTrialActive(trialEndsAt)) return 'BASIC'
  return plan
}
