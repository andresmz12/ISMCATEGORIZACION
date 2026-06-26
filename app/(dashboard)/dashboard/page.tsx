'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { useActiveBiz } from '@/lib/use-active-biz'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function greeting(name: string, t: (k: any) => string) {
  const h = new Date().getHours()
  const key = h < 12 ? 'dashboard.greeting.morning' : h < 18 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening'
  return `${t(key as any)}, ${name.split(' ')[0]}`
}

// Simple SVG donut chart
function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const radius = 60
  const stroke = 22
  const cx = 80
  const cy = 80
  const circumference = 2 * Math.PI * radius

  let offset = 0
  const segments = data.map(d => {
    const pct = d.value / total
    const dashArray = pct * circumference
    const seg = { ...d, pct, dashArray, dashOffset: circumference - offset }
    offset += dashArray
    return seg
  })

  return (
    <div className="flex items-center gap-4">
      <svg width="160" height="160" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
            strokeDashoffset={seg.dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.3s' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-800 font-bold" fontSize="13">
          {fmt(total).replace(/\.\d+/, '')}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-400" fontSize="10">total</text>
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.slice(0, 6).map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-gray-600 truncate flex-1">{d.name}</span>
            <span className="text-xs font-medium text-gray-700 flex-shrink-0">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CHART_COLORS = ['#1B4965', '#2EC4B6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6366f1']

export default function DashboardPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const { businesses, activeBizId, loading } = useActiveBiz()
  const activeBiz = businesses.find(b => b.id === activeBizId) || null

  const currentYear = new Date().getFullYear()
  const [from, setFrom] = useState(`${currentYear}-01-01`)
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])

  const [report, setReport] = useState<any>(null)
  const [txs, setTxs] = useState<any[]>([])

  useEffect(() => {
    if (!activeBizId) return
    fetch(`/api/reports?businessId=${activeBizId}&from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setReport(d))
      .catch(() => setReport(null))
  }, [activeBizId, from, to])

  useEffect(() => {
    if (!activeBizId) return
    fetch(`/api/transactions?businessId=${activeBizId}&limit=8&from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : { transactions: [] })
      .then(d => setTxs(Array.isArray(d?.transactions) ? d.transactions : []))
      .catch(() => setTxs([]))
  }, [activeBizId, from, to])

  const income = report?.summary.income ?? 0
  const expenses = report?.summary.totalExpenses ?? 0
  const profit = report?.summary.netProfit ?? 0
  const deductible = report?.summary.totalDeductible ?? 0

  const now = new Date()

  // Monthly expenses from report data
  const reportMonths: { label: string; income: number; expenses: number }[] = report?.byMonth?.slice(-6).map((m: any) => ({
    label: m.month.substring(5, 7),
    income: m.income,
    expenses: m.expenses,
  })) ?? []

  // Fallback: last 6 month labels if no report yet
  const months = reportMonths.length > 0 ? reportMonths : Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { label: d.toLocaleString('default', { month: 'short' }), income: 0, expenses: 0 }
  })
  const maxMonthly = Math.max(...months.map(m => m.expenses), 1)

  // By category for donut
  const donutData = (report?.expensesByCategory ?? [])
    .slice(0, 8)
    .map((c: any, i: number) => ({ name: c.name, value: c.total, color: CHART_COLORS[i] || '#94a3b8' }))

  // Recent transactions
  const recentTxs = txs.slice(0, 8)

  const quickRanges = [
    { label: 'Todo', from: '2020-01-01', to: new Date().toISOString().split('T')[0] },
    { label: `${currentYear}`, from: `${currentYear}-01-01`, to: new Date().toISOString().split('T')[0] },
    { label: `${currentYear - 1}`, from: `${currentYear - 1}-01-01`, to: `${currentYear - 1}-12-31` },
    { label: 'Q1', from: `${currentYear}-01-01`, to: `${currentYear}-03-31` },
    { label: 'Q2', from: `${currentYear}-04-01`, to: `${currentYear}-06-30` },
    { label: 'Q3', from: `${currentYear}-07-01`, to: `${currentYear}-09-30` },
    { label: 'Q4', from: `${currentYear}-10-01`, to: `${currentYear}-12-31` },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-400 text-sm">{t('auth.loading')}</div>
      </div>
    )
  }

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <div className="text-4xl mb-4">🏢</div>
        <h2 className="text-lg font-semibold text-gray-800">{t('dashboard.noBusinesses')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('dashboard.addFirst')}</p>
        <Link href="/negocios" className="btn-primary mt-6 px-6 py-2">{t('settings.addBusiness')}</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">
            {session?.user?.name ? greeting(session.user.name, t) : t('nav.dashboard')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeBiz?.name} · {t('dashboard.allMovements')}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/clasificar"
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4965] text-white rounded-xl text-sm font-semibold hover:bg-[#153d52] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('nav.classify')}
          </Link>
        </div>
      </div>

      {/* Date filter */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input type="date" className="input w-auto text-sm py-1.5" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm">→</span>
        <input type="date" className="input w-auto text-sm py-1.5" value={to} onChange={e => setTo(e.target.value)} />
        <div className="flex gap-1.5 flex-wrap ml-1">
          {quickRanges.map(r => (
            <button
              key={r.label}
              onClick={() => { setFrom(r.from); setTo(r.to) }}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${from === r.from && to === r.to ? 'bg-[#1B4965] text-white border-[#1B4965]' : 'border-gray-200 text-gray-600 hover:border-[#1B4965] hover:text-[#1B4965]'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>


      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: t('dashboard.income'),
            value: income,
            color: '#059669',
            iconBg: 'rgb(16 185 129 / 0.10)',
            icon: <svg className="w-3.5 h-3.5" style={{ color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
          },
          {
            label: t('dashboard.expenses'),
            value: expenses,
            color: '#dc2626',
            iconBg: 'rgb(239 68 68 / 0.10)',
            icon: <svg className="w-3.5 h-3.5" style={{ color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
          },
          {
            label: t('dashboard.profit'),
            value: profit,
            color: profit >= 0 ? '#059669' : '#dc2626',
            iconBg: profit >= 0 ? 'rgb(16 185 129 / 0.10)' : 'rgb(239 68 68 / 0.10)',
            icon: <svg className="w-3.5 h-3.5" style={{ color: profit >= 0 ? '#059669' : '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
          },
          {
            label: t('dashboard.deductible'),
            value: deductible,
            color: '#1B4965',
            iconBg: 'rgb(27 73 101 / 0.10)',
            icon: <svg className="w-3.5 h-3.5 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
          },
        ].map((card, idx) => (
          <div
            key={card.label}
            className="card p-4 flex flex-col gap-2 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
            data-hover
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: card.iconBg }}>
                {card.icon}
              </div>
            </div>
            <p className="amount-lg" style={{ color: card.color }}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly bar chart */}
        <div className="card p-5">
          <h3 className="section-title mb-4">{t('dashboard.monthlyExpenses')}</h3>
          <div className="flex items-end gap-2 h-36">
            {months.map(({ label, expenses: val }) => {
              const pct = maxMonthly > 0 ? (val / maxMonthly) * 100 : 0
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '112px' }}>
                    <div
                      className="w-full bg-[#1B4965] hover:bg-[#2A6080] transition-colors rounded-t"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={fmt(val)}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Donut chart — by category */}
        <div className="card p-5">
          <h3 className="section-title mb-4">{t('dashboard.byCategory')}</h3>
          {donutData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('common.noData')}</p>
          ) : (
            <DonutChart data={donutData} />
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="section-title">{t('dashboard.recentTx')}</h3>
          <Link href="/transactions" className="text-xs text-[#1B4965] font-medium hover:underline">{t('dashboard.viewAll')}</Link>
        </div>
        {recentTxs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t('tx.noData')}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTxs.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {tx.type === 'CREDIT' ? '+' : '−'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()} · {tx.category?.name || t('tx.unassigned')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`amount-sm ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'CREDIT' ? '+' : '−'}{fmt(tx.amount)}
                  </p>
                  <span className={
                    tx.status === 'CLASSIFIED' ? 'badge-classified' :
                    tx.status === 'NEEDS_REVIEW' ? 'badge-needs-review' :
                    'badge-pending'
                  }>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
                    {tx.status === 'CLASSIFIED' ? t('tx.classified') : tx.status === 'NEEDS_REVIEW' ? t('tx.needsReview') : t('tx.pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
