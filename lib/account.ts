import { prisma } from './prisma'

// Resolves the BillingAccount that owns a business. AI budget, AI usage, and
// the chat assistant toggle all live on the account (not the business) so
// they're shared across every business the account owns and every team
// member invited into it — an account can have several businesses, and the
// budget/feature flags apply to all of them together, not one at a time.
// Ownership is expressed via BusinessUser.role === 'OWNER', not a direct FK
// on Business (see POST /api/businesses).
export async function getBusinessAccountId(businessId: string): Promise<string | null> {
  const owner = await prisma.businessUser.findFirst({
    where: { businessId, role: 'OWNER' },
    select: { user: { select: { accountId: true } } },
  })
  return owner?.user.accountId ?? null
}
