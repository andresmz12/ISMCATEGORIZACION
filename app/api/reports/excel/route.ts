import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Prevent CSV/formula injection: strip leading =, +, -, @ from string cells
function safe(val: unknown): unknown {
  if (typeof val !== 'string') return val
  return /^[=+\-@]/.test(val) ? `'${val}` : val
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { businessName, period, transactions } = await req.json()
  if (!transactions?.length) return NextResponse.json({ error: 'No transactions' }, { status: 400 })
  if (transactions.length > 50000) return NextResponse.json({ error: 'Too many transactions' }, { status: 400 })

  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = ''
  wb.created = new Date()

  // ── Sheet 1: All transactions ──
  const ws = wb.addWorksheet('Transacciones')
  ws.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Monto', key: 'amount', width: 14 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Categoría', key: 'category', width: 28 },
    { header: 'Deducible', key: 'deductibility', width: 12 },
    { header: 'Confianza IA', key: 'confidence', width: 14 },
    { header: 'Código IRS', key: 'irsCode', width: 20 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4965' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 20

  for (const tx of transactions) {
    const row = ws.addRow({
      date: tx.date ? new Date(tx.date).toLocaleDateString('en-US') : '',
      description: safe(tx.description),
      amount: typeof tx.amount === 'number' ? tx.amount : 0,
      type: tx.type === 'CREDIT' ? 'Ingreso' : 'Gasto',
      category: safe(tx.category?.name || tx.aiSuggestion || 'Sin categoría'),
      deductibility: tx.deductibility === 'YES' ? '100%' : tx.deductibility === 'FIFTY' ? '50%' : 'No',
      confidence: tx.aiConfidence || '',
      irsCode: safe(tx.category?.irsCode || ''),
    })
    const amtCell = row.getCell('amount')
    amtCell.numFmt = '"$"#,##0.00'
    if (tx.type === 'CREDIT') {
      amtCell.font = { color: { argb: 'FF059669' } }
    } else {
      amtCell.font = { color: { argb: 'FFDC2626' } }
    }
    if (tx.aiConfidence === 'LOW' || tx.status === 'NEEDS_REVIEW') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }
    }
  }

  ws.autoFilter = { from: 'A1', to: 'H1' }

  // ── Sheet 2: By Category ──
  const wsCat = wb.addWorksheet('Por Categoría')
  const catTotals: Record<string, { name: string; irsCode: string; total: number; deductible: number; count: number }> = {}

  for (const tx of transactions.filter((t: any) => t.type === 'DEBIT')) {
    const name = tx.category?.name || tx.aiSuggestion || 'Sin categoría'
    if (!catTotals[name]) catTotals[name] = { name, irsCode: tx.category?.irsCode || '', total: 0, deductible: 0, count: 0 }
    catTotals[name].total += tx.amount
    catTotals[name].count += 1
    if (tx.deductibility === 'YES') catTotals[name].deductible += tx.amount
    else if (tx.deductibility === 'FIFTY') catTotals[name].deductible += tx.amount * 0.5
  }

  wsCat.columns = [
    { header: 'Categoría', key: 'name', width: 30 },
    { header: 'Código IRS', key: 'irsCode', width: 22 },
    { header: 'Total Gastos', key: 'total', width: 16 },
    { header: 'Total Deducible', key: 'deductible', width: 18 },
    { header: '# Transacciones', key: 'count', width: 16 },
  ]

  const catHeader = wsCat.getRow(1)
  catHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  catHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4965' } }
  catHeader.height = 20

  const sorted = Object.values(catTotals).sort((a, b) => b.total - a.total)
  for (const cat of sorted) {
    const row = wsCat.addRow(cat)
    row.getCell('total').numFmt = '"$"#,##0.00'
    row.getCell('deductible').numFmt = '"$"#,##0.00'
  }

  // ── Sheet 3: Summary ──
  const wsSummary = wb.addWorksheet('Resumen')
  const income = transactions.filter((t: any) => t.type === 'CREDIT').reduce((s: number, t: any) => s + t.amount, 0)
  const expenses = transactions.filter((t: any) => t.type === 'DEBIT').reduce((s: number, t: any) => s + t.amount, 0)
  const totalDeductible = sorted.reduce((s, c) => s + c.deductible, 0)

  wsSummary.addRow(['Reporte — ' + businessName])
  wsSummary.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1B4965' } }
  wsSummary.addRow([period || ''])
  wsSummary.addRow([])
  wsSummary.addRow(['Concepto', 'Valor'])
  const summaryHeader = wsSummary.getRow(4)
  summaryHeader.font = { bold: true }
  summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5EEF4' } }
  const summaryData = [
    ['Total Ingresos', income],
    ['Total Gastos', expenses],
    ['Ganancia Neta', income - expenses],
    ['Total Deducible', totalDeductible],
    ['Total Transacciones', transactions.length],
  ]
  for (const [label, val] of summaryData) {
    const r = wsSummary.addRow([label, val])
    if (typeof val === 'number') r.getCell(2).numFmt = '"$"#,##0.00'
  }
  wsSummary.getColumn(1).width = 26
  wsSummary.getColumn(2).width = 18

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-${Date.now()}.xlsx"`,
    },
  })
}
