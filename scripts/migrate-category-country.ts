import { PrismaClient } from '@prisma/client'

// Backfills Category.country on rows created before that column existed.
// It was added nullable with no default, so every pre-existing system
// category (all of them originally US Schedule C categories, plus whatever
// a superadmin added since) landed with country: NULL — which the app's
// category-filtering logic (see lib/categories.ts) treats as "shared with
// every business, regardless of country." That leaked the whole US category
// list into Colombian businesses' dropdowns and reports.
//
// Transfer/Uncategorized used to be the two genuinely shared (country: NULL)
// buckets, but they now have a translated Colombian pair (Transferencia/Sin
// Categorizar — see lib/system-categories.ts and
// scripts/migrate-co-shared-categories.ts), so the English originals are
// US-only like every other still-unset system category and get backfilled
// here too. Runs after `prisma db push` (see package.json) so the column
// already exists; idempotent — a category admins have since explicitly
// tagged (country no longer NULL) is left untouched.
async function main() {
  const prisma = new PrismaClient()
  try {
    const count = await prisma.$executeRawUnsafe(`
      UPDATE "Category"
      SET country = 'US'
      WHERE "isSystem" = true
        AND country IS NULL
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
