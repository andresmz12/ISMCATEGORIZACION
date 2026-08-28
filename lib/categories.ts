import { unstable_cache, revalidateTag } from 'next/cache'
import { prisma } from './prisma'

// The category list (system + business-owned) changes rarely but is read on
// nearly every classification/import/report path. Cache it per business,
// revalidated on any category mutation via revalidateCategories() below.
export const getBusinessCategories = unstable_cache(
  async (businessId: string) => {
    return prisma.category.findMany({
      where: { OR: [{ isSystem: true }, { businessId }] },
      select: { id: true, name: true, irsCode: true, description: true, isSystem: true, businessId: true },
    })
  },
  ['business-categories'],
  { tags: ['categories'], revalidate: 300 }
)

export const getSystemCategories = unstable_cache(
  async () => {
    return prisma.category.findMany({ where: { isSystem: true } })
  },
  ['system-categories'],
  { tags: ['categories'], revalidate: 300 }
)

// Category mutations are infrequent (admin/business-owner actions), so a
// single coarse tag is fine — no need to track per-business cache entries.
export function revalidateCategories(): void {
  revalidateTag('categories')
}
