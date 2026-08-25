import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { parseTransactionDate } from '@/lib/date'
import { materializeDueRecurring } from '@/lib/recurring'

const VALID_FREQUENCIES = new Set(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
const VALID_DEDUCTIBILITY = new Set(['YES', 'NO', 'FIFTY'])

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await materializeDueRecurring(businessId)

  const templates = await prisma.recurringTransaction.findMany({
    where: { businessId },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const body = await req.json()
  const { businessId, description, amount, type, categoryId, deductibility, frequency, startDate, endDate, notes } = body

  if (!businessId || !description || !frequency || !startDate) {
    return NextResponse.json({ error: 'businessId, description, frequency and startDate required' }, { status: 400 })
  }
  const parsedAmount = Number(amount)
  if (!isFinite(parsedAmount) || parsedAmount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  if (!VALID_FREQUENCIES.has(frequency)) return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  const parsedStart = parseTransactionDate(startDate)
  if (!parsedStart) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  const parsedEnd = endDate ? parseTransactionDate(endDate) : null
  if (endDate && !parsedEnd) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
  if (parsedEnd && parsedEnd < parsedStart) return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 })
  const resolvedDeductibility = VALID_DEDUCTIBILITY.has(deductibility) ? deductibility : null
  const txType = type === 'CREDIT' ? 'CREDIT' : 'DEBIT'
  const trimmedNotes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 2000) : null

  if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let resolvedCategoryId: string | null = null
  if (categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, OR: [{ businessId }, { isSystem: true }] } })
    if (!cat) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    resolvedCategoryId = cat.id
  }

  const template = await prisma.recurringTransaction.create({
    data: {
      businessId,
      description: description.trim().slice(0, 500),
      amount: parsedAmount,
      type: txType,
      categoryId: resolvedCategoryId,
      deductibility: resolvedDeductibility,
      frequency,
      startDate: parsedStart,
      nextDate: parsedStart,
      endDate: parsedEnd,
      notes: trimmedNotes,
    },
    include: { category: true },
  })
  await logAudit({ userId, businessId, action: 'CREATE_RECURRING', entity: 'RecurringTransaction', entityId: template.id, metadata: { description, amount: parsedAmount, frequency } })

  // The first occurrence may already be due (startDate in the past or today)
  // — materialize immediately so it shows up without waiting for the next read.
  await materializeDueRecurring(businessId)

  return NextResponse.json(template, { status: 201 })
}
