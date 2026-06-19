'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function greeting(name: string, t: (k: any) => string) {
  const h = new Date().getHours()
  const key = h < 12 ? 'dashboard.greeting.morning' : h < 18 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening'
  return `${t(key as any)}, ${name.split(' ')[0]}`
}

function SimpleBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(value)}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<any>(null)
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setBusinesses(d)
          setActiveBiz(d[0])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/transactions?businessId=${activeBiz.id}&limit=200`)
      .then(r => r.json())
      .then(d => setTxs(Array.isArray(d.transactions) ? d.transactions : []))
      .catch(() => {})
  }, [activeBiz])

  const now = new Date()
  const ytdTxs = txs.filter(tx => new Date(tx.date).getFullYear() === now.getFullYear())
  const income = ytdTxs.filter(tx => tx.type === 'CREDIT').reduce((s, tx) => s + tx.amount, 0)
  const expenses = ytdTxs.filter(tx => tx.type === 'DEBIT').reduce((s, tx) => s + tx.amount, 0)
  const profit = income - expenses
  const deductible = ytdTxs.filter(tx => tx.deductibility === 'YES').reduce((s, tx) => s + tx.amount, 0)
  const pending = txs.filter(tx => tx.status === 'PENDING').length
  const classified = txs.filter(tx => tx.status === 'CLASSIFIED').length

  // Monthly expenses (last 6 months)
  const monthlyData: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short' })
    monthlyData[key] = 0
  }
  ytdTxs.filter(tx => tx.type === 'DEBIT').forEach(tx => {
    const d = new Date(tx.date)
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (monthsAgo >= 0 && monthsAgo <= 5) {
      const key = d.toLocaleString('default', { month: 'short' })
      monthlyData[key] = (monthlyData[key] || 0) + tx.amount
    }
  })

  // By category
  const byCat: Record<string, number> = {}
  ytdTxs.filter(tx => tx.type === 'DEBIT' && tx.category?.name).forEach(tx => {
    byCat[tx.category.name] = (byCat[tx.category.name] || 0) + tx.amount
  })
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const maxMonthly = Math.max(...Object.values(monthlyData), 1)
  const maxCat = topCats[0]?.[1] || 1

  const recentTxs = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

  const catColors = ['bg-[#1B4965]', 'bg-[#2EC4B6]', 'bg-blue-400', 'bg-indigo-400', 'bg-purple-400']

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
        <Link href="/settings" className="btn-primary mt-6 px-6 py-2">{t('settings.addBusiness')}</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {session?.user?.name ? greeting(session.user.name, t) : t('nav.dashboard')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeBiz?.name} · {t('dashboard.ytd')}</p>
        </div>
        {businesses.length > 1 && (
          <select
            className="input w-auto text-sm"
            value={activeBiz?.id}
            onChange={e => setActiveBiz(businesses.find(b => b.id === e.target.value))}
          >
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.income'), value: income, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '↑' },
          { label: t('dashboard.expenses'), value: expenses, color: 'text-red-600', bg: 'bg-red-50', icon: '↓' },
          { label: t('dashboard.profit'), value: profit, color: profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: profit >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: '=' },
          { label: t('dashboard.deductible'), value: deductible, color: 'text-[#1B4965]', bg: 'bg-blue-50', icon: '✓' },
        ].map(card => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{card.label}</span>
              <div className={`${card.bg} w-7 h-7 rounded-lg flex items-center justify-center`}>
                <span className={`text-sm font-bold ${card.color}`}>{card.icon}</span>
              </div>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly bar chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('dashboard.monthlyExpenses')}</h3>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(monthlyData).map(([month, val]) => {
              const pct = maxMonthly > 0 ? (val / maxMonthly) * 100 : 0
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                    <div
                      className="w-full bg-[#1B4965] rounded-t-sm hover:bg-[#2A6080] transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={fmt(val)}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By category */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('dashboard.byCategory')}</h3>
          {topCats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('common.noData')}</p>
          ) : (
            <div className="space-y-3">
              {topCats.map(([name, val], i) => (
                <SimpleBar key={name} label={name} value={val} max={maxCat} color={catColors[i] || 'bg-gray-400'} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.quickActions')}</h3>
          <div className="space-y-2">
            {pending > 0 ? (
              <Link href="/transactions" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors">
                <span>⚡</span>
                {t('dashboard.reviewPending').replace('{n}', String(pending))}
              </Link>
            ) : (
              <p className="text-sm text-gray-400 py-2">{t('dashboard.noPending')}</p>
            )}
            <Link href="/import" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-[#1B4965] text-sm font-medium hover:bg-blue-100 transition-colors">
              <span>📥</span> {t('tx.import')}
            </Link>
            <Link href="/reports" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 transition-colors">
              <span>📊</span> {t('reports.exportPDF')}
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-amber-600">{pending}</p>
              <p className="text-xs text-gray-500">{t('dashboard.pending')}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{classified}</p>
              <p className="text-xs text-gray-500">{t('dashboard.classified')}</p>
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">{t('dashboard.recentTx')}</h3>
            <Link href="/transactions" className="text-xs text-[#1B4965] font-medium hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          {recentTxs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('tx.noData')}</p>
          ) : (
            <div className="space-y-0 divide-y divide-gray-50">
              {recentTxs.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {tx.type === 'CREDIT' ? '+' : '−'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'CREDIT' ? '+' : '−'}{fmt(tx.amount)}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tx.status === 'CLASSIFIED' ? 'bg-emerald-100 text-emerald-700' :
                      tx.status === 'NEEDS_REVIEW' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {tx.status === 'CLASSIFIED' ? t('tx.classified') : tx.status === 'NEEDS_REVIEW' ? t('tx.needsReview') : t('tx.pending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
