import { cache } from 'react'
import { prisma } from './prisma'

// Memoized per request: routes that check access more than once for the same
// (userId, businessId) pair (e.g. a handler that reads then writes) reuse the
// same lookup instead of round-tripping to the DB again.
const getBusinessUser = cache(async (userId: string, businessId: string) => {
  return prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
})

/**
 * Returns true if the user has access to the given business.
 * SUPERADMIN bypasses the BusinessUser check entirely.
 */
export async function checkBusinessAccess(
  userId: string,
  businessId: string,
  accountType?: string
): Promise<boolean> {
  if (accountType === 'SUPERADMIN') return true
  const bu = await getBusinessUser(userId, businessId)
  return !!bu
}

/**
 * Like checkBusinessAccess, but also requires the user's role to be OWNER or
 * MANAGER — VIEWER is read-only and must not pass this check. Use this on any
 * endpoint that creates, updates, or deletes business data.
 */
export async function checkBusinessWriteAccess(
  userId: string,
  businessId: string,
  accountType?: string
): Promise<boolean> {
  if (accountType === 'SUPERADMIN') return true
  const bu = await getBusinessUser(userId, businessId)
  return !!bu && bu.role !== 'VIEWER'
}
