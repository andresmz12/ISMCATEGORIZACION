import { PrismaClient } from '@prisma/client'
import { systemCategoryId } from '../lib/system-categories'

// Transfer/Uncategorized used to be a single shared (country: NULL) pair of
// categories shown to every business. They're now split into a US pair
// (Transfer/Uncategorized) and a translated CO pair (Transferencia/Sin
// Categorizar) — see lib/system-categories.ts. Any Colombian business that
// already had transactions, recurring templates, splits, or rules pointing
// at the old English IDs needs those repointed at the new Spanish ones, or
// they'd keep an English category name after this change ships.
//
// Must run after scripts/seed-categories.ts (so the new CO rows already
// exist) — see package.json's start chain. Idempotent: once repointed, a
// second run finds nothing left on the old US-only IDs for CO businesses.
async function main() {
  const prisma = new PrismaClient()
  try {
    const oldTransferId = systemCategoryId('Transfer')
    const oldUncategorizedId = systemCategoryId('Uncategorized')
    const newTransferId = systemCategoryId('Transferencia')
    const newUncategorizedId = systemCategoryId('Sin Categorizar')

    const pairs = [
      { oldId: oldTransferId, newId: newTransferId },
      { oldId: oldUncategorizedId, newId: newUncategorizedId },
    ]

    let total = 0
    for (const { oldId, newId } of pairs) {
      total += await prisma.$executeRawUnsafe(`
        UPDATE "Transaction" SET "categoryId" = $1
        WHERE "categoryId" = $2
          AND "businessId" IN (SELECT id FROM "Business" WHERE country = 'CO')
      `, newId, oldId)

      total += await prisma.$executeRawUnsafe(`
        UPDATE "RecurringTransaction" SET "categoryId" = $1
        WHERE "categoryId" = $2
          AND "businessId" IN (SELECT id FROM "Business" WHERE country = 'CO')
      `, newId, oldId)

      total += await prisma.$executeRawUnsafe(`
        UPDATE "ClassificationRule" SET "categoryId" = $1
        WHERE "categoryId" = $2
          AND "businessId" IN (SELECT id FROM "Business" WHERE country = 'CO')
      `, newId, oldId)

      total += await prisma.$executeRawUnsafe(`
        UPDATE "TransactionSplit" SET "categoryId" = $1
        WHERE "categoryId" = $2
          AND "transactionId" IN (
            SELECT id FROM "Transaction"
            WHERE "businessId" IN (SELECT id FROM "Business" WHERE country = 'CO')
          )
      `, newId, oldId)
    }

    console.log(`migrate-co-shared-categories: repointed ${total} rows from US Transfer/Uncategorized to their CO equivalents`)
  } catch (e: any) {
    console.error('migrate-co-shared-categories FAILED:', e?.message ?? e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
