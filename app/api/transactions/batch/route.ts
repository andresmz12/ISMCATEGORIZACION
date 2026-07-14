import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'

function makeChecksum(date: string, description: string, amount: number): string {
  return crypto.createHash('md5').update(`${date}|${description}|${amount}`).digest('hex')
}

// Bulk-create classified transactions after user review.
// Skips duplicates automatically.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  try {
    const { businessId, transactions, sourceFile } = await req.json()
    if (!businessId || !Array.isArray(transactions) || !transactions.length) {
      return NextResponse.json({ error: 'businessId and transactions required' }, { status: 400 })
    }
    if (transactions.length > 500) {
      return NextResponse.json({ error: 'Max 500 transactions per batch' }, { status: 400 })
    }
    if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let created = 0
    let duplicates = 0
    const errors: string[] = []
    const createdIds: string[] = []

    // Only accept categoryIds that actually belong to this business (or are system categories) —
    // otherwise a client could attach a category from a business it has no access to.
    const requestedCategoryIds = [...new Set(transactions.map((t: any) => t.categoryId).filter(Boolean))]
    const validCategoryIds = requestedCategoryIds.length
      ? new Set((await prisma.category.findMany({
          where: { id: { in: requestedCategoryIds }, OR: [{ businessId }, { isSystem: true }] },
          select: { id: true },
        })).map(c => c.id))
      : new Set<string>()

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i]
      try {
        const dateObj = new Date(t.date)
        if (isNaN(dateObj.getTime())) { errors.push(`Row ${i + 1}: invalid date`); continue }
        if (!t.description?.trim()) { errors.push(`Row ${i + 1}: empty description`); continue }
        const amount = Number(t.amount)
        if (isNaN(amount) || amount <= 0) { errors.push(`Row ${i + 1}: invalid amount`); continue }
        const categoryId = t.categoryId && validCategoryIds.has(t.categoryId) ? t.categoryId : null

        const dateStr = dateObj.toISOString().split('T')[0]
        const checksum = makeChecksum(dateStr, t.description.trim(), amount)

        const result = await prisma.$transaction(async (tx: any) => {
          const existing = await tx.transaction.findFirst({ where: { businessId, checksum } })
          if (existing) return { type: 'duplicate' }
          const newTx = await tx.transaction.create({
            data: {
              businessId,
              date: dateObj,
              description: t.description.trim(),
              amount,
              type: t.type || 'DEBIT',
              status: categoryId ? 'CLASSIFIED' : 'PENDING',
              categoryId,
              deductibility: t.deductibility || null,
              aiConfidence: t.aiConfidence || null,
              aiSuggestion: t.aiSuggestion || null,
              method: categoryId ? 'AI' : null,
              checksum,
              sourceFile: sourceFile || null,
            },
          })
          return { type: 'created', id: newTx.id }
        })

        if (result.type === 'duplicate') {
          duplicates++
        } else {
          created++
          if (result.id) createdIds.push(result.id)
        }
      } catch (e: any) {
        // P2002 = unique constraint violation on (businessId, checksum) — a
        // concurrent request beat this one to it; treat as a duplicate, not an error.
        if (e.code === 'P2002') {
          duplicates++
          continue
        }
        errors.push(`Row ${i + 1}: ${e.message}`)
      }
    }

    await logAudit({
      userId,
      businessId,
      action: 'IMPORT_TRANSACTIONS',
      // Use the same metadata keys as /api/import so the bank import history
      // (bancos page) renders counts and filename consistently for both flows.
      metadata: { imported: created, duplicates, errors: errors.length, total: transactions.length, file: sourceFile },
    })

    return NextResponse.json({ created, duplicates, errors, total: transactions.length, createdIds })
  } catch (e: any) {
    console.error('batch import error:', e)
    return NextResponse.json({ error: 'Error al guardar transacciones' }, { status: 500 })
  }
}
