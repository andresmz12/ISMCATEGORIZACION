import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { addRecurrenceInterval, RecurrenceFrequency } from './date'

const MAX_CATCHUP = 24 // cap how many missed occurrences one pass backfills, in case a template went unvisited for a long time

// Turns due RecurringTransaction templates into real Transaction rows. There's
// no cron/job runner in this deployment, so occurrences are materialized
// lazily — called from the read paths (GET /api/transactions, GET
// /api/reports) instead of on a fixed schedule. An atomic updateMany "claims"
// each template by its current nextDate before writing rows, so two requests
// racing for the same business (e.g. the dashboard fetching both endpoints
// at once) can't double-create the same occurrence.
type PendingRow = Prisma.TransactionCreateManyInput

export async function materializeDueRecurring(businessId: string): Promise<void> {
  const now = new Date()
  const templates = await prisma.recurringTransaction.findMany({
    where: { businessId, active: true, nextDate: { lte: now } },
  })

  if (templates.length === 0) return

  // Claim each template with its own compare-and-swap (still one updateMany
  // per template, since each has a different nextDate/active target — but
  // run concurrently instead of serially, and collect rows for a single
  // batched createMany below, instead of one round trip per template.
  const perTemplateRows = await Promise.all(
    templates.map(async (tpl): Promise<PendingRow[]> => {
      const occurrences: Date[] = []
      let cursor = tpl.nextDate
      while (
        cursor <= now &&
        occurrences.length < MAX_CATCHUP &&
        !(tpl.endDate && cursor > tpl.endDate)
      ) {
        occurrences.push(cursor)
        cursor = addRecurrenceInterval(cursor, tpl.frequency as RecurrenceFrequency, 1)
      }

      const stillActive = !(tpl.endDate && cursor > tpl.endDate)

      if (occurrences.length === 0) {
        // Nothing to create — this only happens once the end date has already
        // passed. Deactivate so it stops showing up in the due-templates query.
        await prisma.recurringTransaction.updateMany({
          where: { id: tpl.id, nextDate: tpl.nextDate },
          data: { active: false },
        })
        return []
      }

      const claim = await prisma.recurringTransaction.updateMany({
        where: { id: tpl.id, nextDate: tpl.nextDate },
        data: { nextDate: cursor, active: stillActive },
      })
      if (claim.count === 0) return [] // a concurrent request already materialized this one

      return occurrences.map(date => ({
        businessId,
        date,
        description: tpl.description,
        amount: tpl.amount,
        type: tpl.type,
        categoryId: tpl.categoryId,
        deductibility: tpl.deductibility,
        method: tpl.categoryId ? ('RECURRING' as const) : undefined,
        status: tpl.categoryId ? ('CLASSIFIED' as const) : ('PENDING' as const),
        notes: tpl.notes,
        recurringId: tpl.id,
      }))
    })
  )

  const rows = perTemplateRows.flat()
  if (rows.length > 0) {
    await prisma.transaction.createMany({ data: rows })
  }
}
