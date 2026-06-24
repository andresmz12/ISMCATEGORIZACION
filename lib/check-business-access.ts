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
