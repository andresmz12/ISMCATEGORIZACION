// Maps our internal Plan enum to the Square Catalog subscription plan
// variations that back them. Those variations must be created ahead of time
// in Square Catalog (SUBSCRIPTION_PLAN + SUBSCRIPTION_PLAN_VARIATION objects,
// one paid phase each, monthly cadence) — the Subscriptions API doesn't let
// you create them inline, they're catalog objects you set up once.
//
// BASIC, PLUS and ENTERPRISE are all paid, fixed-price tiers ($20/$50/$80)
// backed by their own Square subscription. CUSTOM has no fixed price
// (negotiated manually), so it's the only tier that isn't self-serve
// checkout and doesn't appear here. NONE isn't a purchasable plan either —
// it's the "hasn't paid" state, never something you check out into.
export type PaidPlan = 'BASIC' | 'PLUS' | 'ENTERPRISE'

export const SQUARE_PAID_PLANS: Record<PaidPlan, { variationIdEnvVar: string; priceCents: number }> = {
  BASIC: { variationIdEnvVar: 'SQUARE_PLAN_VARIATION_ID_BASIC', priceCents: 2000 },
  PLUS: { variationIdEnvVar: 'SQUARE_PLAN_VARIATION_ID_PLUS', priceCents: 5000 },
  ENTERPRISE: { variationIdEnvVar: 'SQUARE_PLAN_VARIATION_ID_ENTERPRISE', priceCents: 8000 },
}

export function getSquarePlanVariationId(plan: PaidPlan): string {
  const envVar = SQUARE_PAID_PLANS[plan].variationIdEnvVar
  const id = process.env[envVar]
  if (!id) throw new Error(`${envVar} is not set`)
  return id
}

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === 'BASIC' || plan === 'PLUS' || plan === 'ENTERPRISE'
}

// Reverse lookup used by the webhook handler: given the plan_variation_id
// Square reports on a subscription, figure out which of our Plan values it
// corresponds to.
export function planFromVariationId(variationId: string | undefined | null): PaidPlan | null {
  if (!variationId) return null
  for (const plan of Object.keys(SQUARE_PAID_PLANS) as PaidPlan[]) {
    if (process.env[SQUARE_PAID_PLANS[plan].variationIdEnvVar] === variationId) return plan
  }
  return null
}
