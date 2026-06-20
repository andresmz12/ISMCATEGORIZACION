import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function checkAccess(userId: string, businessId: string) {
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  return !!bu
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const body = await req.json()
  const { businessId, date, description, amount, type } = body
  if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const tx = await prisma.transaction.create({
    data: { businessId, date: new Date(date), description, amount: Number(amount), type: type || 'DEBIT', status: 'PENDING' },
  })
  return NextResponse.json(tx, { status: 201 })
}
