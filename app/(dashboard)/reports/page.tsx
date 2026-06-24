'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useActiveBiz } from '@/lib/use-active-biz'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const { businesses, activeBizId } = useActiveBiz()
  const activeBiz = activeBizId
  const accountType = (session?.user as any)?.accountType
  const plan = (session?.user as any)?.plan || 'BASIC'
  const isPremium = accountType === 'SUPERADMIN' || plan === 'PLUS' || plan === 'ENTERPRISE'
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('2020-01-01')
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!activeBiz) return
    setLoading(true)
    setReport(null)
    fetch(`/api/reports?businessId=${activeBiz}&from=${from}&to=${to}`)
      .then(r => { if (!r.ok) throw new Error('failed'); return r.json() })
      .then(d => setReport(d))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [activeBiz, from, to])

  function exportCSV() {
    if (!report) return
    const biz = businesses.find((b: any) => b.id === activeBiz)
    const rows: string[][] = [
      [`${t('reports.expenseReport')} — ${biz?.name || activeBiz}`],
      [t('reports.period'), `${from} → ${to}`],
      [],
      [t('reports.summary')],
      [t('reports.totalIncome'), String(report.summary.income)],
      [t('reports.totalExpenses'), String(report.summary.totalExpenses)],
      [t('reports.netProfit'), String(report.summary.netProfit)],
      [t('reports.totalDeductible'), String(report.summary.totalDeductible)],
      [],
      [t('reports.expensesByCategory')],
      [t('tx.category'), t('reports.total'), t('reports.deductible'), t('reports.count')],
      ...report.expensesByCategory.map((c: any) => [c.name, String(c.total), String(c.deductible), String(c.count)]),
      [],
      [t('reports.monthly')],
      [t('reports.month'), t('dashboard.income'), t('dashboard.expenses'), 'Net'],
      ...report.byMonth.map((m: any) => [m.month, String(m.income), String(m.expenses), String(m.income - m.expenses)]),
    ]
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `report_${activeBiz}_${from}_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    if (!report) return
    setExporting(true)
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const biz = businesses.find((b: any) => b.id === activeBiz)
    doc.setFontSize(18)
    doc.text(`${t('reports.expenseReport')} — ${biz?.name || ''}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`${t('reports.period')}: ${from} → ${to}`, 14, 30)
    doc.setFontSize(12)
    doc.text(t('reports.summary'), 14, 44)
    autoTable(doc, {
      startY: 48,
      head: [['', t('reports.total')]],
      body: [
        [t('reports.totalIncome'), fmt(report.summary.income)],
        [t('reports.totalExpenses'), fmt(report.summary.totalExpenses)],
        [t('reports.netProfit'), fmt(report.summary.netProfit)],
        [t('reports.totalDeductible'), fmt(report.summary.totalDeductible)],
      ],
    })
    const y1 = (doc as any).lastAutoTable.finalY + 10
    doc.text(t('reports.expensesByCategory'), 14, y1)
    autoTable(doc, {
      startY: y1 + 4,
      head: [[t('tx.category'), t('reports.total'), t('reports.deductible'), t('reports.count')]],
      body: report.expensesByCategory.map((c: any) => [
        c.name, fmt(c.total), fmt(c.deductible), c.count,
      ]),
    })
    doc.save(`report_${activeBiz}_${from}_${to}.pdf`)
    setExporting(false)
  }

  async function exportExcel() {
    if (!report) return
    setExporting(true)
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const biz = businesses.find((b: any) => b.id === activeBiz)

    const ws1 = wb.addWorksheet(t('reports.summary'))
    ws1.addRows([
      [t('reports.expenseReport')],
      [t('business.name') + ':', biz?.name || activeBiz],
      [t('reports.period') + ':', `${from} → ${to}`],
      [],
      ['', t('reports.total')],
      [t('reports.totalIncome'), report.summary.income],
      [t('reports.totalExpenses'), report.summary.totalExpenses],
      [t('reports.netProfit'), report.summary.netProfit],
      [t('reports.totalDeductible'), report.summary.totalDeductible],
    ])

    const ws2 = wb.addWorksheet(t('reports.byCategory'))
    ws2.addRow([t('tx.category'), t('reports.total'), t('reports.deductible'), t('reports.count')])
    report.expensesByCategory.forEach((c: any) => ws2.addRow([c.name, c.total, c.deductible, c.count]))

    const ws3 = wb.addWorksheet(t('reports.monthly'))
    ws3.addRow([t('reports.month'), t('dashboard.income'), t('dashboard.expenses'), 'Net'])
    report.byMonth.forEach((m: any) => ws3.addRow([m.month, m.income, m.expenses, m.income - m.expenses]))

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `report_${activeBiz}_${from}_${to}.xlsx`; a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function exportTransactionsByCategory() {
    if (!activeBiz) return
    setExporting(true)
    try {
      const params = new URLSearchParams({ businessId: activeBiz, limit: '5000' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      const txs: any[] = data.transactions || []

      // Group by category name
      const grouped: Record<string, any[]> = {}
      for (const tx of txs) {
        const cat = tx.category?.name || 'Sin categoría'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(tx)
      }

      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const biz = businesses.find((b: any) => b.id === activeBiz)
      wb.created = new Date()

      const ws = wb.addWorksheet('Transacciones por Categoría')
      ws.columns = [
        { key: 'date', width: 14 },
        { key: 'desc', width: 44 },
        { key: 'amount', width: 15 },
        { key: 'type', width: 10 },
        { key: 'status', width: 13 },
        { key: 'ded', width: 11 },
      ]

      // Title
      ws.addRow([`${biz?.name || ''} — Transacciones por Categoría`])
      ws.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1B4965' } }
      ws.addRow([`Período: ${from} → ${to}  ·  ${txs.length} transacciones`])
      ws.getRow(2).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
      ws.addRow([])

      const BLUE = 'FF1B4965'
      const BLUE_LIGHT = 'FFE5EEF4'
      const sortedCats = Object.keys(grouped).sort((a, b) => {
        if (a === 'Sin categoría') return 1
        if (b === 'Sin categoría') return -1
        return a.localeCompare(b)
      })

      for (const catName of sortedCats) {
        const catTxs = grouped[catName].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const debitTotal = catTxs.filter((tx: any) => tx.type === 'DEBIT').reduce((s: number, tx: any) => s + tx.amount, 0)
        const creditTotal = catTxs.filter((tx: any) => tx.type === 'CREDIT').reduce((s: number, tx: any) => s + tx.amount, 0)

        // Category header row
        const catTotal = debitTotal > 0 ? debitTotal : creditTotal
        const catRow = ws.addRow([catName, `${catTxs.length} transacciones`, catTotal])
        catRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        catRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        catRow.height = 18
        catRow.getCell(3).numFmt = '"$"#,##0.00'

        // Column sub-headers
        const hRow = ws.addRow(['Fecha', 'Descripción', 'Monto', 'Tipo', 'Estado', 'Deducible'])
        hRow.font = { bold: true, size: 9, color: { argb: 'FF1B4965' } }
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_LIGHT } }

        for (const tx of catTxs) {
          const row = ws.addRow([
            new Date(tx.date).toLocaleDateString('es-CO'),
            tx.description,
            tx.amount,
            tx.type === 'CREDIT' ? 'Ingreso' : 'Gasto',
            tx.status === 'CLASSIFIED' ? 'Clasificado' : tx.status === 'PENDING' ? 'Pendiente' : 'Revisar',
            tx.deductibility === 'YES' ? '100%' : tx.deductibility === 'FIFTY' ? '50%' : '-',
          ])
          row.getCell(3).numFmt = '"$"#,##0.00'
          row.getCell(3).font = { color: { argb: tx.type === 'CREDIT' ? 'FF059669' : 'FFDC2626' } }
          row.height = 15
        }

        // Subtotal row
        const subRow = ws.addRow(['', `Subtotal ${catName}`, catTotal])
        subRow.font = { bold: true, italic: true, size: 9 }
        subRow.getCell(3).numFmt = '"$"#,##0.00'
        subRow.getCell(3).font = { bold: true, italic: true, color: { argb: debitTotal > 0 ? 'FFDC2626' : 'FF059669' } }

        ws.addRow([]) // spacer between categories
      }

      ws.autoFilter = undefined

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transacciones-por-categoria_${from}_${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function exportCorporatePDF() {
    if (!report || !activeBiz) return
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const biz = businesses.find((b: any) => b.id === activeBiz)
      const bizName = biz?.name || ''
      const W = 210
      const BLUE = [27, 73, 101] as [number, number, number]
      const TEAL = [46, 196, 182] as [number, number, number]
      const WHITE: [number, number, number] = [255, 255, 255]

      // ── PAGE 1: COVER ──────────────────────────────────────────────
      doc.setFillColor(...BLUE)
      doc.rect(0, 0, W, 297, 'F')

      // Accent bar
      doc.setFillColor(...TEAL)
      doc.rect(0, 0, 8, 297, 'F')

      // Report type label
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 225)
      doc.text('Reporte Corporativo Financiero', 24, 52)

      // Divider
      doc.setDrawColor(...TEAL)
      doc.setLineWidth(0.5)
      doc.line(24, 72, W - 24, 72)

      // Business name
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...WHITE)
      const titleLines = doc.splitTextToSize(bizName, W - 48)
      doc.text(titleLines, 24, 90)

      // Period
      const yPeriod = 90 + titleLines.length * 12
      doc.setFontSize(13)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...TEAL)
      doc.text(`Período: ${from} — ${to}`, 24, yPeriod + 8)

      // Stats summary on cover
      const stats = [
        { label: 'Ingresos', val: fmt(report.summary.income) },
        { label: 'Gastos', val: fmt(report.summary.totalExpenses) },
        { label: 'Utilidad Neta', val: fmt(report.summary.netProfit) },
        { label: 'Deducible', val: fmt(report.summary.totalDeductible) },
      ]
      const cardY = yPeriod + 28
      const cardW = (W - 48 - 9) / 2
      stats.forEach((s, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const cx = 24 + col * (cardW + 6)
        const cy = cardY + row * 26
        doc.setFillColor(255, 255, 255, 0.08)
        doc.setFillColor(35, 90, 120)
        doc.roundedRect(cx, cy, cardW, 20, 2, 2, 'F')
        doc.setFontSize(8)
        doc.setTextColor(160, 200, 220)
        doc.text(s.label.toUpperCase(), cx + 4, cy + 7)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...WHITE)
        doc.text(s.val, cx + 4, cy + 16)
      })

      // Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 150, 170)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`, 24, 280)
      doc.text('Confidencial', W - 24, 280, { align: 'right' })

      // ── PAGE 2: P&L SUMMARY ──────────────────────────────────────────
      doc.addPage()

      // Header bar
      doc.setFillColor(...BLUE)
      doc.rect(0, 0, W, 20, 'F')
      doc.setFillColor(...TEAL)
      doc.rect(0, 0, 8, 20, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...WHITE)
      doc.text('Estado de Resultados', 16, 13)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 225)
      doc.text(bizName, W - 14, 13, { align: 'right' })

      autoTable(doc, {
        startY: 28,
        head: [['Concepto', 'Monto']],
        body: [
          ['Total Ingresos', fmt(report.summary.income)],
          ['Total Gastos', fmt(report.summary.totalExpenses)],
          ['Utilidad Neta', fmt(report.summary.netProfit)],
          ['Total Deducible', fmt(report.summary.totalDeductible)],
          ['Pendientes de clasificar', String(report.summary.pending)],
          ['Clasificadas', String(report.summary.classified)],
        ],
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [240, 246, 250] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      })

      // ── PAGE 3: MONTHLY BAR CHART ─────────────────────────────────────
      doc.addPage()

      doc.setFillColor(...BLUE)
      doc.rect(0, 0, W, 20, 'F')
      doc.setFillColor(...TEAL)
      doc.rect(0, 0, 8, 20, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...WHITE)
      doc.text('Tendencia Mensual', 16, 13)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 225)
      doc.text(bizName, W - 14, 13, { align: 'right' })

      const months = report.byMonth.slice(-12)
      if (months.length > 0) {
        const chartX = 20
        const chartY = 35
        const chartW = W - 40
        const chartH = 80
        const maxVal = Math.max(...months.flatMap((m: any) => [m.income, m.expenses]), 1)
        const barW = (chartW / months.length) * 0.35
        const gap = chartW / months.length

        // Grid lines
        doc.setDrawColor(220, 230, 235)
        doc.setLineWidth(0.2)
        for (let i = 0; i <= 4; i++) {
          const y = chartY + chartH - (i / 4) * chartH
          doc.line(chartX, y, chartX + chartW, y)
          const label = fmt((maxVal * i) / 4).replace(/\.\d+/, '')
          doc.setFontSize(6)
          doc.setTextColor(150, 160, 170)
          doc.text(label, chartX - 2, y + 1, { align: 'right' })
        }

        months.forEach((m: any, i: number) => {
          const x = chartX + i * gap + gap * 0.1
          const incH = (m.income / maxVal) * chartH
          const expH = (m.expenses / maxVal) * chartH

          // Income bar (teal)
          doc.setFillColor(...TEAL)
          doc.rect(x, chartY + chartH - incH, barW, incH, 'F')

          // Expense bar (blue)
          doc.setFillColor(...BLUE)
          doc.rect(x + barW + 1, chartY + chartH - expH, barW, expH, 'F')

          // Month label
          doc.setFontSize(6.5)
          doc.setTextColor(80, 100, 120)
          doc.text(m.month.substring(0, 7), x + barW, chartY + chartH + 5, { align: 'center' })
        })

        // Legend
        doc.setFillColor(...TEAL)
        doc.rect(chartX, chartY + chartH + 14, 6, 4, 'F')
        doc.setFontSize(8)
        doc.setTextColor(60, 80, 100)
        doc.text('Ingresos', chartX + 8, chartY + chartH + 17.5)

        doc.setFillColor(...BLUE)
        doc.rect(chartX + 40, chartY + chartH + 14, 6, 4, 'F')
        doc.text('Gastos', chartX + 48, chartY + chartH + 17.5)
      }

      // Monthly table below chart
      const tableY = (doc as any).lastAutoTable?.finalY ?? 150
      autoTable(doc, {
        startY: 145,
        head: [['Mes', 'Ingresos', 'Gastos', 'Neto']],
        body: months.map((m: any) => [
          m.month,
          fmt(m.income),
          fmt(m.expenses),
          fmt(m.income - m.expenses),
        ]),
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 246, 250] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      })

      // ── PAGE 4: EXPENSES BY CATEGORY ──────────────────────────────────
      doc.addPage()

      doc.setFillColor(...BLUE)
      doc.rect(0, 0, W, 20, 'F')
      doc.setFillColor(...TEAL)
      doc.rect(0, 0, 8, 20, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...WHITE)
      doc.text('Gastos por Categoría', 16, 13)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 210, 225)
      doc.text(bizName, W - 14, 13, { align: 'right' })

      const cats = report.expensesByCategory.slice(0, 12)
      const maxCat = Math.max(...cats.map((c: any) => c.total), 1)
      const barChartX = 70
      const barChartW = W - barChartX - 50
      const rowH = 9

      cats.forEach((c: any, i: number) => {
        const y = 30 + i * rowH
        const bw = (c.total / maxCat) * barChartW

        doc.setFontSize(7.5)
        doc.setTextColor(40, 60, 80)
        const label = c.name.length > 22 ? c.name.substring(0, 21) + '…' : c.name
        doc.text(label, barChartX - 4, y + 5, { align: 'right' })

        doc.setFillColor(230, 238, 244)
        doc.rect(barChartX, y, barChartW, 6, 'F')

        doc.setFillColor(...BLUE)
        doc.rect(barChartX, y, bw, 6, 'F')

        doc.setFontSize(7)
        doc.setTextColor(60, 80, 100)
        doc.text(fmt(c.total).replace(/\.\d+/, ''), barChartX + barChartW + 3, y + 5)
      })

      autoTable(doc, {
        startY: 30 + cats.length * rowH + 10,
        head: [['Categoría', 'Total', 'Deducible', 'Transacciones']],
        body: cats.map((c: any) => [c.name, fmt(c.total), fmt(c.deductible), c.count]),
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 246, 250] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' } },
      })

      // Page numbers on all pages
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(7)
        doc.setTextColor(160, 170, 180)
        doc.text(`Página ${p} de ${pageCount}`, W / 2, 292, { align: 'center' })
      }

      doc.save(`reporte-corporativo_${bizName.replace(/\s+/g, '-')}_${from}_${to}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const year = new Date().getFullYear()
  const quickRanges = [
    { label: 'Todo', from: '2020-01-01', to: new Date().toISOString().split('T')[0] },
    { label: t('reports.thisYear'), from: `${year}-01-01`, to: new Date().toISOString().split('T')[0] },
    { label: `${year - 1}`, from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    { label: 'Q1', from: `${year}-01-01`, to: `${year}-03-31` },
    { label: 'Q2', from: `${year}-04-01`, to: `${year}-06-30` },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('reports.title')}</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} disabled={!report} className="btn-secondary text-sm disabled:opacity-50">
            {t('reports.exportCSV')}
          </button>
          <button onClick={exportPDF} disabled={exporting || !report} className="btn-secondary text-sm disabled:opacity-50">
            {exporting ? t('reports.generating') : t('reports.exportPDF')}
          </button>
          <button onClick={exportExcel} disabled={exporting || !report} className="btn-primary text-sm disabled:opacity-50">
            {exporting ? t('reports.generating') : t('reports.exportExcel')}
          </button>
          <button onClick={exportTransactionsByCategory} disabled={exporting || !activeBiz} className="btn-secondary text-sm disabled:opacity-50">
            {exporting ? t('reports.generating') : 'Tx por Categoría'}
          </button>
          {isPremium ? (
            <button
              onClick={exportCorporatePDF}
              disabled={exporting || !report}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#1B4965] to-[#2EC4B6] text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? 'Generando...' : 'Reporte Corporativo'}
            </button>
          ) : (
            <div className="relative group">
              <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#1B4965] to-[#2EC4B6] text-white opacity-40 cursor-not-allowed shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Reporte Corporativo
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-50 shadow-lg">
                Disponible en planes Plus y Enterprise
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date range */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">{t('reports.from')}</label>
          <input type="date" className="input w-auto text-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('reports.to')}</label>
          <input type="date" className="input w-auto text-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickRanges.map(p => (
            <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to) }} className="btn-secondary text-xs py-1 px-2">{p.label}</button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400 text-sm">{t('common.loading')}</div>}
      {!loading && !report && activeBiz && (
        <div className="card p-8 text-center text-gray-400 text-sm">{t('reports.noData')}</div>
      )}

      {report && !loading && (
        <>
          {/* P&L Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('reports.totalIncome'), val: report.summary.income, color: 'text-emerald-700' },
              { label: t('reports.totalExpenses'), val: report.summary.totalExpenses, color: 'text-red-600' },
              { label: t('reports.netProfit'), val: report.summary.netProfit, color: report.summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: t('reports.totalDeductible'), val: report.summary.totalDeductible, color: 'text-[#1B4965]' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Monthly trend */}
          {report.byMonth.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-4">{t('reports.monthlyBreakdown')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('reports.month')}</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('dashboard.income')}</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('dashboard.expenses')}</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('dashboard.profit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.byMonth.map((m: any) => (
                      <tr key={m.month}>
                        <td className="py-2 text-gray-700">{m.month}</td>
                        <td className="py-2 text-right text-emerald-700">{fmt(m.income)}</td>
                        <td className="py-2 text-right text-red-600">{fmt(m.expenses)}</td>
                        <td className={`py-2 text-right font-semibold ${m.income - m.expenses >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {fmt(m.income - m.expenses)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenses by category */}
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">{t('reports.expensesByCategory')}</h2>
            {report.expensesByCategory.length === 0 ? (
              <p className="text-sm text-gray-400">{t('reports.noExpenses')}</p>
            ) : (
              <div className="space-y-2">
                {report.expensesByCategory.map((c: any) => {
                  const pct = report.summary.totalExpenses > 0 ? (c.total / report.summary.totalExpenses * 100) : 0
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div>
                          <span className="font-medium text-gray-800">{c.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-800">{fmt(c.total)}</span>
                          <span className="ml-2 text-xs text-gray-400">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1B4965] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
