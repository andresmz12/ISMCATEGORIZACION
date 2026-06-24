import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

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
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = { businessId }
  if (status) where.status = status
  if (categoryId) where.categoryId = categoryId
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }
  if (search) where.description = { contains: search, mode: 'insensitive' }

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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const body = await req.json()
  const { businessId, date, description, amount, type } = body
  if (!businessId || !date || !description) return NextResponse.json({ error: 'businessId, date, description required' }, { status: 400 })
  const parsedAmount = Number(amount)
  if (!isFinite(parsedAmount) || parsedAmount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tx = await prisma.transaction.create({
    data: { businessId, date: new Date(date), description, amount: parsedAmount, type: type || 'DEBIT', status: 'PENDING' },
  })
  await logAudit({ userId, businessId, action: 'CREATE_TRANSACTION', entity: 'Transaction', entityId: tx.id, metadata: { description, amount: parsedAmount, type: type || 'DEBIT' } })
  return NextResponse.json(tx, { status: 201 })
}
