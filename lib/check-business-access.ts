import { prisma } from './prisma'

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
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
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
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
  return !!bu && bu.role !== 'VIEWER'
}
