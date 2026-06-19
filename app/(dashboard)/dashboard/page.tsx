'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function DashboardPage() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(data => {
      setBusinesses(data)
      if (data.length > 0) {
        const saved = localStorage.getItem('activeBusiness')
        const found = saved ? data.find((b: any) => b.id === saved) : null
        setActiveBiz(found || data[0])
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!activeBiz) return
    localStorage.setItem('activeBusiness', activeBiz.id)
    const now = new Date()
    const from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    const to = now.toISOString().split('T')[0]
    fetch(`/api/reports?businessId=${activeBiz.id}&from=${from}&to=${to}`)
      .then(r => r.json()).then(setReport)
  }, [activeBiz])

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>

  if (businesses.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-5xl mb-4">🏢</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No businesses yet</h2>
        <p className="text-gray-500 mb-6">Create your first business to get started</p>
        <Link href="/settings" className="btn-primary">Add Business</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Year-to-date summary</p>
        </div>
        {businesses.length > 1 && (
          <select
            className="input w-auto"
            value={activeBiz?.id}
            onChange={e => setActiveBiz(businesses.find((b: any) => b.id === e.target.value))}
          >
            {businesses.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {businesses.length === 1 && (
          <span className="text-sm font-medium text-gray-700">{activeBiz?.name}</span>
        )}
      </div>

      {/* Stats */}
      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Income', value: fmt(report.summary.income), color: 'text-green-700' },
              { label: 'Total Expenses', value: fmt(report.summary.totalExpenses), color: 'text-red-600' },
              { label: 'Net Profit', value: fmt(report.summary.netProfit), color: report.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Deductible', value: fmt(report.summary.totalDeductible), color: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Transaction Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="badge-pending">Pending</span>
                  <span className="font-semibold text-gray-800">{report.summary.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="badge-classified">Classified</span>
                  <span className="font-semibold text-gray-800">{report.summary.classified}</span>
                </div>
              </div>
              {report.summary.pending > 0 && (
                <Link href="/transactions?status=PENDING" className="mt-4 block text-sm text-yellow-700 font-medium hover:underline">
                  Review {report.summary.pending} pending →
                </Link>
              )}
            </div>

            {/* Top categories */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Expense Categories</h3>
              <div className="space-y-2">
                {report.expensesByCategory.slice(0, 5).map((c: any) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate max-w-[180px]">{c.name}</span>
                    <span className="text-sm font-semibold text-gray-800">{fmt(c.total)}</span>
                  </div>
                ))}
                {report.expensesByCategory.length === 0 && (
                  <p className="text-sm text-gray-400">No classified expenses yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-3 flex-wrap">
            <Link href="/import" className="btn-primary">Import Transactions</Link>
            <Link href="/transactions" className="btn-secondary">View All Transactions</Link>
            <Link href="/reports" className="btn-secondary">Full Report</Link>
          </div>
        </>
      )}
    </div>
  )
}
