import { PrismaClient } from '@prisma/client'
import { SYSTEM_CATEGORIES, systemCategoryId } from '../lib/system-categories'

// One-time sync of irsCode/vatRate/retefuente onto system categories that
// already existed in the database before this pass — retefuente was just
// added (a brand-new column, so every pre-existing row has it NULL and
// nothing to clobber), and irsCode gained the Formulario 110 casilla
// citation (e.g. "PUC 5110 · F.110 Casilla 63") which pre-existing rows
// don't have yet either. seed-categories.ts only creates missing rows —
// it never updates ones that already exist, by design, so this fills that
// gap for this specific correction. Scoped to isSystem rows only; a
// business's own custom categories are never touched.
//
// Safe to re-run: it always re-applies the same source-of-truth values, so
// a second run is a no-op in practice (values already match).
async function main() {
  const prisma = new PrismaClient()
  try {
    let updated = 0
    for (const c of SYSTEM_CATEGORIES) {
      const id = systemCategoryId(c.name)
      const result = await prisma.category.updateMany({
        where: { id, isSystem: true },
        data: { irsCode: c.irsCode, vatRate: c.vatRate || null, retefuente: c.retefuente || null },
      })
      updated += result.count
    }
    console.log(`migrate-retefuente-casillas: synced irsCode/vatRate/retefuente on ${updated} existing system categories`)
  } catch (e: any) {
    console.error('migrate-retefuente-casillas FAILED:', e?.message ?? e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
