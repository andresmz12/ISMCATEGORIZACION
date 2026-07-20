import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { endOfDay, parseTransactionDate, addRecurrenceInterval, RecurrenceFrequency } from '@/lib/date'

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

  const status = searchParams.get('status')
  const categoryId = searchParams.get('categoryId')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const ids = searchParams.get('ids') // comma-separated list of specific IDs
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(1000, parseInt(searchParams.get('limit') || '50'))

  const where: any = { businessId }
  if (ids) {
    const idList = ids.split(',').filter(Boolean)
    where.id = { in: idList }
  } else {
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (type === 'CREDIT' || type === 'DEBIT') where.type = type
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = endOfDay(to)
    }
    if (search) where.description = { contains: search, mode: 'insensitive' }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, splits: { include: { category: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page, limit })
}

const VALID_DEDUCTIBILITY = new Set(['YES', 'NO', 'FIFTY'])
const VALID_FREQUENCIES = new Set(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
const MAX_REPEAT_COUNT = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const body = await req.json()
  const { businessId, date, description, amount, type, categoryId, deductibility, notes, repeatCount, repeatFrequency } = body
  if (!businessId || !date || !description) return NextResponse.json({ error: 'businessId, date, description required' }, { status: 400 })
  const parsedAmount = Number(amount)
  if (!isFinite(parsedAmount) || parsedAmount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  const parsedDate = parseTransactionDate(date)
  if (!parsedDate) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const txType = type === 'CREDIT' ? 'CREDIT' : 'DEBIT'

  let resolvedCategoryId: string | null = null
  if (categoryId) {
    // A category may be business-owned or a shared system category (businessId: null) —
    // same rule the classification/import paths use. Never trust the ID blindly.
    const cat = await prisma.category.findFirst({ where: { id: categoryId, OR: [{ businessId }, { businessId: null }] } })
    if (!cat) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    resolvedCategoryId = cat.id
  }
  const resolvedDeductibility = VALID_DEDUCTIBILITY.has(deductibility) ? deductibility : null
  const trimmedNotes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 2000) : null

  // Recurring entry: same amount/category/notes repeated on a cadence — e.g.
  // "rent, monthly, for the next 12 months". Count includes the first entry.
  const count = Math.min(Math.max(parseInt(repeatCount) || 1, 1), MAX_REPEAT_COUNT)
  const frequency: RecurrenceFrequency = VALID_FREQUENCIES.has(repeatFrequency) ? repeatFrequency : 'MONTHLY'

  const rowsData = Array.from({ length: count }, (_, i) => ({
    businessId,
    date: i === 0 ? parsedDate : addRecurrenceInterval(parsedDate, frequency, i),
    description,
    amount: parsedAmount,
    type: txType,
    status: resolvedCategoryId ? 'CLASSIFIED' : 'PENDING',
    categoryId: resolvedCategoryId,
    deductibility: resolvedDeductibility,
    method: resolvedCategoryId ? 'MANUAL' : undefined,
    notes: trimmedNotes,
  } as const))

  const created = await prisma.$transaction(rowsData.map(data => prisma.transaction.create({ data })))

  await logAudit({
    userId,
    businessId,
    action: 'CREATE_TRANSACTION',
    entity: 'Transaction',
    entityId: created[0].id,
    metadata: { description, amount: parsedAmount, type: txType, repeatCount: count, repeatFrequency: count > 1 ? frequency : undefined },
  })

  return NextResponse.json({ transactions: created, count: created.length }, { status: 201 })
}
