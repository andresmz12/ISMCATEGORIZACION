import { PrismaClient } from '@prisma/client'
import { SYSTEM_CATEGORIES, systemCategoryId } from '../lib/system-categories'

// Keeps the deployed database's system categories in sync with
// lib/system-categories.ts on every boot — not just on first install. The
// production DB is never re-seeded from prisma/seed.ts (that's dev-only) or
// re-bootstrapped from /api/setup (one-time, disables itself once any user
// exists), so a category added to that shared list after go-live — like the
// expanded Colombian PUC set — would otherwise never reach an already-running
// deployment. Upsert is a create-if-missing, update-nothing-if-present: it
// never touches a category name/description a superadmin has since edited.
async function main() {
  const prisma = new PrismaClient()
  try {
    let created = 0
    for (const c of SYSTEM_CATEGORIES) {
      const id = systemCategoryId(c.name)
      const existing = await prisma.category.findUnique({ where: { id }, select: { id: true } })
      if (existing) continue
      await prisma.category.create({
        data: { id, name: c.name, irsCode: c.irsCode, country: c.country, vatRate: c.vatRate || null, isSystem: true },
      })
      created++
    }
    console.log(`seed-categories: created ${created} new system categories (${SYSTEM_CATEGORIES.length} total defined)`)
  } catch (e: any) {
    console.error('seed-categories FAILED:', e?.message ?? e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
