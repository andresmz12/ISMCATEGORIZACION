import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const where: any = { businessId }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
  })

  const income = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0)

  const expensesByCategory: Record<string, { name: string; irsCode: string | null; total: number; deductible: number; count: number }> = {}

  for (const t of transactions.filter(t => t.type === 'DEBIT')) {
    const catName = t.category?.name || 'Uncategorized'
    const catCode = t.category?.irsCode || null
    if (!expensesByCategory[catName]) {
      expensesByCategory[catName] = { name: catName, irsCode: catCode, total: 0, deductible: 0, count: 0 }
    }
    expensesByCategory[catName].total += t.amount
    expensesByCategory[catName].count += 1
    if (t.deductibility === 'YES') expensesByCategory[catName].deductible += t.amount
    else if (t.deductibility === 'FIFTY') expensesByCategory[catName].deductible += t.amount * 0.5
  }

  const totalExpenses = Object.values(expensesByCategory).reduce((s, c) => s + c.total, 0)
  const totalDeductible = Object.values(expensesByCategory).reduce((s, c) => s + c.deductible, 0)

  const byMonth: Record<string, { income: number; expenses: number }> = {}
  for (const t of transactions) {
    const key = t.date.toISOString().substring(0, 7)
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 }
    if (t.type === 'CREDIT') byMonth[key].income += t.amount
    else byMonth[key].expenses += t.amount
  }

  const pending = transactions.filter(t => t.status === 'PENDING').length
  const classified = transactions.filter(t => t.status === 'CLASSIFIED').length

  return NextResponse.json({
    summary: { income, totalExpenses, netProfit: income - totalExpenses, totalDeductible, pending, classified },
    expensesByCategory: Object.values(expensesByCategory).sort((a, b) => b.total - a.total),
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
  })
}
