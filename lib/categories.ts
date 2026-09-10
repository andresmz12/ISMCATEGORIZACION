import { unstable_cache, revalidateTag } from 'next/cache'
import { prisma } from './prisma'

// The category list (system + business-owned) changes rarely but is read on
// nearly every classification/import/report path. Cache it per business,
// revalidated on any category mutation via revalidateCategories() below.
//
// System categories are scoped by the business's country: a US business
// never sees Colombian PUC categories and vice versa. Categories with
// country: null (Transfer, Uncategorized) are shown to every business.
export const getBusinessCategories = unstable_cache(
  async (businessId: string) => {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { country: true } })
    return prisma.category.findMany({
      where: {
        OR: [
          { isSystem: true, country: null },
          { isSystem: true, country: business?.country ?? 'US' },
          { businessId },
        ],
      },
      select: { id: true, name: true, irsCode: true, description: true, isSystem: true, businessId: true, country: true },
    })
  },
  ['business-categories'],
  { tags: ['categories'], revalidate: 300 }
)

export const getSystemCategories = unstable_cache(
  async (country?: 'US' | 'CO') => {
    return prisma.category.findMany({
      where: { isSystem: true, ...(country ? { OR: [{ country: null }, { country }] } : {}) },
    })
  },
  ['system-categories'],
  { tags: ['categories'], revalidate: 300 }
)

// Category mutations are infrequent (admin/business-owner actions), so a
// single coarse tag is fine — no need to track per-business cache entries.
export function revalidateCategories(): void {
  revalidateTag('categories')
}
