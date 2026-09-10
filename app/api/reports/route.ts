import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { endOfDay } from '@/lib/date'
import { materializeDueRecurring } from '@/lib/recurring'

const round = (n: number) => Math.round(n * 100) / 100

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await materializeDueRecurring(businessId)

  const where: any = { businessId }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = endOfDay(to)
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
  })

  const income = round(transactions
    .filter((t: any) => t.type === 'CREDIT')
    .reduce((sum: number, t: any) => sum + t.amount, 0))

  const expensesByCategory: Record<string, { name: string; irsCode: string | null; total: number; deductible: number; count: number }> = {}

  for (const t of transactions.filter((t: any) => t.type === 'DEBIT')) {
    const catName = t.category?.name || 'Uncategorized'
    const catCode = t.category?.irsCode || null
    if (!expensesByCategory[catName]) {
      expensesByCategory[catName] = { name: catName, irsCode: catCode, total: 0, deductible: 0, count: 0 }
    }
    expensesByCategory[catName].total = round(expensesByCategory[catName].total + t.amount)
    expensesByCategory[catName].count += 1
    if (t.deductibility === 'YES') expensesByCategory[catName].deductible = round(expensesByCategory[catName].deductible + t.amount)
    else if (t.deductibility === 'FIFTY') expensesByCategory[catName].deductible = round(expensesByCategory[catName].deductible + t.amount * 0.5)
  }

  const totalExpenses = round(Object.values(expensesByCategory).reduce((s, c) => s + c.total, 0))
  const totalDeductible = round(Object.values(expensesByCategory).reduce((s, c) => s + c.deductible, 0))

  const byMonth: Record<string, { income: number; expenses: number }> = {}
  for (const t of transactions) {
    const key = t.date.toISOString().substring(0, 7)
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 }
    if (t.type === 'CREDIT') byMonth[key].income = round(byMonth[key].income + t.amount)
    else byMonth[key].expenses = round(byMonth[key].expenses + t.amount)
  }

  const pending = transactions.filter((t: any) => t.status === 'PENDING').length
  const classified = transactions.filter((t: any) => t.status === 'CLASSIFIED').length

  const debits = transactions.filter((t: any) => t.type === 'DEBIT')

  // Per-category monthly totals (debits only) — the raw matrix behind the
  // month-over-month / "what varies" comparison. The UI picks which two
  // months to diff instead of the API baking in a fixed comparison.
  const monthKeys = new Set<string>()
  const categoryMonthlyMap: Record<string, Record<string, number>> = {}
  for (const t of debits) {
    const month = t.date.toISOString().substring(0, 7)
    monthKeys.add(month)
    const catName = t.category?.name || 'Uncategorized'
    if (!categoryMonthlyMap[catName]) categoryMonthlyMap[catName] = {}
    categoryMonthlyMap[catName][month] = round((categoryMonthlyMap[catName][month] || 0) + t.amount)
  }
  const sortedMonths = Array.from(monthKeys).sort()
  const categoryMonthly = Object.entries(categoryMonthlyMap).map(([name, months]) => ({ name, months }))

  // % participation of each category within its own cost center.
  const costCenterMap: Record<string, { costCenter: string; total: number; count: number; categories: Record<string, number> }> = {}
  for (const t of debits) {
    if (!t.costCenter) continue
    if (!costCenterMap[t.costCenter]) costCenterMap[t.costCenter] = { costCenter: t.costCenter, total: 0, count: 0, categories: {} }
    const cc = costCenterMap[t.costCenter]
    cc.total = round(cc.total + t.amount)
    cc.count += 1
    const catName = t.category?.name || 'Uncategorized'
    cc.categories[catName] = round((cc.categories[catName] || 0) + t.amount)
  }
  const costCenters = Object.values(costCenterMap)
    .map(cc => ({
      costCenter: cc.costCenter,
      total: cc.total,
      count: cc.count,
      categories: Object.entries(cc.categories)
        .map(([name, total]) => ({ name, total, percent: cc.total > 0 ? round((total / cc.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total)

  // Grouped by the VAT/IVA rate carried on each transaction's category — the
  // filter accountants use to pull numbers for a Colombian IVA declaration.
  // "Sin IVA asignado" covers uncategorized spend or categories with no rate set.
  const vatMap: Record<string, { vatRate: string; total: number; deductible: number; count: number }> = {}
  for (const t of debits) {
    const vatRate = t.category?.vatRate || 'Sin IVA asignado'
    if (!vatMap[vatRate]) vatMap[vatRate] = { vatRate, total: 0, deductible: 0, count: 0 }
    vatMap[vatRate].total = round(vatMap[vatRate].total + t.amount)
    vatMap[vatRate].count += 1
    if (t.deductibility === 'YES') vatMap[vatRate].deductible = round(vatMap[vatRate].deductible + t.amount)
    else if (t.deductibility === 'FIFTY') vatMap[vatRate].deductible = round(vatMap[vatRate].deductible + t.amount * 0.5)
  }
  const vat = Object.values(vatMap).sort((a, b) => b.total - a.total)

  // Grouped by the retención en la fuente rate carried on each transaction's
  // category — an estimate of what should have been withheld, to cross-check
  // against certificados de retención. Only categories with a parseable %
  // (e.g. "11%") get an estimate; "N/A" / unset ones are grouped separately
  // since there's no single rate to apply.
  const retefuenteMap: Record<string, { retefuente: string; total: number; estimated: number; count: number }> = {}
  for (const t of debits) {
    const retefuente = t.category?.retefuente || 'Sin retención asignada'
    if (!retefuenteMap[retefuente]) retefuenteMap[retefuente] = { retefuente, total: 0, estimated: 0, count: 0 }
    const r = retefuenteMap[retefuente]
    r.total = round(r.total + t.amount)
    r.count += 1
    const pct = parseFloat(retefuente)
    if (!isNaN(pct) && retefuente.trim().endsWith('%')) r.estimated = round(r.estimated + t.amount * (pct / 100))
  }
  const retefuente = Object.values(retefuenteMap).sort((a, b) => b.total - a.total)

  // Spend + purchase frequency by vendor (only transactions with a vendor set).
  const vendorMap: Record<string, { vendor: string; total: number; count: number; lastDate: string }> = {}
  for (const t of debits) {
    if (!t.vendor) continue
    if (!vendorMap[t.vendor]) vendorMap[t.vendor] = { vendor: t.vendor, total: 0, count: 0, lastDate: t.date.toISOString() }
    const v = vendorMap[t.vendor]
    v.total = round(v.total + t.amount)
    v.count += 1
    if (t.date.toISOString() > v.lastDate) v.lastDate = t.date.toISOString()
  }
  const vendors = Object.values(vendorMap)
    .map(v => ({ ...v, avg: round(v.total / v.count) }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({
    summary: { income, totalExpenses, netProfit: round(income - totalExpenses), totalDeductible, pending, classified },
    expensesByCategory: Object.values(expensesByCategory).sort((a, b) => b.total - a.total),
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    months: sortedMonths,
    categoryMonthly,
    costCenters,
    vat,
    retefuente,
    vendors,
  })
}
