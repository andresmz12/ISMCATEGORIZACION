import { PrismaClient } from '@prisma/client'

// Backfills Category.country on rows created before that column existed.
// It was added nullable with no default, so every pre-existing system
// category (all of them originally US Schedule C categories, plus whatever
// a superadmin added since) landed with country: NULL — which the app's
// category-filtering logic (see lib/categories.ts) treats as "shared with
// every business, regardless of country." That leaked the whole US category
// list into Colombian businesses' dropdowns and reports.
//
// Only the two genuinely shared buckets (Transfer, Uncategorized) should
// stay NULL; every other still-unset system category gets backfilled to US,
// since that's what every category was before this app supported Colombia.
// Runs after `prisma db push` (see package.json) so the column already
// exists; idempotent — a category admins have since explicitly tagged
// (country no longer NULL) is left untouched.
async function main() {
  const prisma = new PrismaClient()
  try {
    const count = await prisma.$executeRawUnsafe(`
      UPDATE "Category"
      SET country = 'US'
      WHERE "isSystem" = true
        AND country IS NULL
        AND name NOT IN ('Transfer', 'Uncategorized')
    `)
    console.log(`migrate-category-country: backfilled ${count} system categories to country=US`)
  } catch (e: any) {
    console.error('migrate-category-country FAILED:', e?.message ?? e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
