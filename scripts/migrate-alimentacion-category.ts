import { PrismaClient } from '@prisma/client'
import { systemCategoryId } from '../lib/system-categories'

// "Alimentación (50% deducible)" was renamed to "Alimentación" in
// lib/system-categories.ts — the "50% deducible" suffix copied the US
// "Meals (50%)" rule by analogy, but Colombia has no such blanket rule for
// food/meal expenses (Estatuto Tributario Art. 107 is a per-expense
// necessity/causality test, not a fixed percentage). Deductibility stays a
// per-transaction field the accountant sets, independent of category.
//
// The rename changes the category's deterministic id (systemCategoryId is
// derived from the name), so seed-categories.ts creates a new "Alimentación"
// row rather than updating the old one in place. This repoints anything
// already using the old id onto the new one and removes the now-orphaned
// old row. Must run after seed-categories.ts (so the new row already
// exists). Idempotent: a second run finds nothing left on the old id.
async function main() {
  const prisma = new PrismaClient()
  try {
    const oldId = systemCategoryId('Alimentación (50% deducible)')
    const newId = systemCategoryId('Alimentación')

    const newExists = await prisma.category.findUnique({ where: { id: newId }, select: { id: true } })
    if (!newExists) {
      console.log('migrate-alimentacion-category: new "Alimentación" category not found yet, skipping (seed-categories.ts should run first)')
      return
    }

    let repointed = 0
    repointed += await prisma.$executeRawUnsafe(
      `UPDATE "Transaction" SET "categoryId" = $1 WHERE "categoryId" = $2`, newId, oldId
    )
    repointed += await prisma.$executeRawUnsafe(
      `UPDATE "RecurringTransaction" SET "categoryId" = $1 WHERE "categoryId" = $2`, newId, oldId
    )
    repointed += await prisma.$executeRawUnsafe(
      `UPDATE "ClassificationRule" SET "categoryId" = $1 WHERE "categoryId" = $2`, newId, oldId
    )
    repointed += await prisma.$executeRawUnsafe(
      `UPDATE "TransactionSplit" SET "categoryId" = $1 WHERE "categoryId" = $2`, newId, oldId
    )

    const deleted = await prisma.category.deleteMany({ where: { id: oldId } })

    console.log(`migrate-alimentacion-category: repointed ${repointed} rows, removed ${deleted.count} orphaned "Alimentación (50% deducible)" category`)
  } catch (e: any) {
    console.error('migrate-alimentacion-category FAILED:', e?.message ?? e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
