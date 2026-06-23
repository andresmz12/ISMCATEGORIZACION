'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<string>('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return
      setBusinesses(data)
      const saved = localStorage.getItem('activeBusiness')
      const biz = (saved && data.find((b: any) => b.id === saved)) || data[0]
      if (biz) setActiveBiz(biz.id)
    })
  }, [])

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
      [`${t('app.short')} — ${t('reports.expenseReport')}`],
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

  const year = new Date().getFullYear()
  const quickRanges = [
    { label: t('reports.thisYear'), from: `${year}-01-01`, to: new Date().toISOString().split('T')[0] },
    { label: 'Q1', from: `${year}-01-01`, to: `${year}-03-31` },
    { label: 'Q2', from: `${year}-04-01`, to: `${year}-06-30` },
    { label: 'Q3', from: `${year}-07-01`, to: `${year}-09-30` },
    { label: 'Q4', from: `${year}-10-01`, to: `${year}-12-31` },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('reports.title')}</h1>
        <div className="flex gap-2 flex-wrap">
          {businesses.length > 1 && (
            <select className="input w-auto text-sm" value={activeBiz} onChange={e => setActiveBiz(e.target.value)}>
              {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button onClick={exportCSV} disabled={!report} className="btn-secondary text-sm disabled:opacity-50">
            {t('reports.exportCSV')}
          </button>
          <button onClick={exportPDF} disabled={exporting || !report} className="btn-secondary text-sm disabled:opacity-50">
            {exporting ? t('reports.generating') : t('reports.exportPDF')}
          </button>
          <button onClick={exportExcel} disabled={exporting || !report} className="btn-primary text-sm disabled:opacity-50">
            {exporting ? t('reports.generating') : t('reports.exportExcel')}
          </button>
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
