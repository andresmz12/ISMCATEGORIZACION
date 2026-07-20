/**
 * One-off script: lists every SUBSCRIPTION_PLAN and SUBSCRIPTION_PLAN_VARIATION
 * in the Square Catalog, so you can read off each variation's ID and match it
 * to a plan by name/price.
 *
 * Usage:
 *   SQUARE_ACCESS_TOKEN=<production access token> npx tsx scripts/list-square-plans.ts
 *
 * Set SQUARE_ENVIRONMENT=sandbox instead of production if you created the
 * plans in Sandbox rather than production. Defaults to production since
 * that's where the plans described in the task were created.
 *
 * Not part of the app build — run manually, once, then throw the IDs into
 * SQUARE_PLAN_VARIATION_ID_BASIC / SQUARE_PLAN_VARIATION_ID_PLUS /
 * SQUARE_PLAN_VARIATION_ID_ENTERPRISE.
 */
import { SquareClient, SquareEnvironment } from 'square'

const token = process.env.SQUARE_ACCESS_TOKEN
if (!token) {
  console.error('SQUARE_ACCESS_TOKEN is not set')
  process.exit(1)
}

const square = new SquareClient({
  token,
  environment: process.env.SQUARE_ENVIRONMENT === 'sandbox' ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
})

function formatMoney(money?: { amount?: bigint | null; currency?: string }): string {
  if (!money?.amount) return '(no price)'
  return `${(Number(money.amount) / 100).toFixed(2)} ${money.currency ?? ''}`.trim()
}

async function main() {
  const plans: { id: string; name: string }[] = []
  const variations: { id: string; name: string; planId?: string | null; phases: string[] }[] = []

  let cursor: string | undefined
  do {
    const response = await square.catalog.search({
      objectTypes: ['SUBSCRIPTION_PLAN', 'SUBSCRIPTION_PLAN_VARIATION'],
      cursor,
    })
    if (response.errors?.length) {
      console.error('Square API errors:', response.errors)
      process.exit(1)
    }

    for (const obj of response.objects ?? []) {
      if (obj.isDeleted) continue
      if (obj.type === 'SUBSCRIPTION_PLAN' && obj.subscriptionPlanData) {
        plans.push({ id: obj.id, name: obj.subscriptionPlanData.name })
      } else if (obj.type === 'SUBSCRIPTION_PLAN_VARIATION' && obj.subscriptionPlanVariationData) {
        const data = obj.subscriptionPlanVariationData
        const phases = (data.phases ?? []).map(
          (p) => `${p.cadence}${p.recurringPriceMoney ? ` @ ${formatMoney(p.recurringPriceMoney)}` : ''}`
        )
        variations.push({ id: obj.id, name: data.name, planId: data.subscriptionPlanId, phases })
      }
    }

    cursor = response.cursor
  } while (cursor)

  if (variations.length === 0) {
    console.log('No SUBSCRIPTION_PLAN_VARIATION objects found. Double-check SQUARE_ACCESS_TOKEN / SQUARE_ENVIRONMENT match where you created the plans.')
    return
  }

  const planNameById = new Map(plans.map((p) => [p.id, p.name]))

  console.log(`Found ${plans.length} plan(s), ${variations.length} variation(s):\n`)
  for (const v of variations) {
    const planName = v.planId ? planNameById.get(v.planId) ?? '(unknown plan)' : '(no parent plan)'
    console.log(`- ${v.name}`)
    console.log(`    variation_id: ${v.id}`)
    console.log(`    plan: ${planName}${v.planId ? ` (${v.planId})` : ''}`)
    console.log(`    phases: ${v.phases.join(', ') || '(none)'}`)
    console.log()
  }

  console.log('Copy each variation_id into the matching env var, e.g.:')
  console.log('  SQUARE_PLAN_VARIATION_ID_BASIC=<id for the $20/mo variation>')
  console.log('  SQUARE_PLAN_VARIATION_ID_PLUS=<id for the $50/mo variation>')
  console.log('  SQUARE_PLAN_VARIATION_ID_ENTERPRISE=<id for the $80/mo variation>')
}

main().catch((err) => {
  console.error('list-square-plans failed:', err)
  process.exit(1)
})
