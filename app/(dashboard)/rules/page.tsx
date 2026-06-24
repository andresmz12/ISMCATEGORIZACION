'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

interface LearnedPattern {
  pattern: string
  categoryName: string
  categoryId: string
  count: number
  lastSeen: string
}

function ManualRules({ activeBiz, categories, t, toast }: {
  activeBiz: string
  categories: any[]
  t: (k: any, v?: any) => string
  toast: (m: string, type?: any) => void
}) {
  const [rules, setRules] = useState<any[]>([])
  const [form, setForm] = useState({ pattern: '', categoryId: '', priority: '0', field: 'description', deductibility: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/rules?businessId=${activeBiz}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRules(d)
    })
  }, [activeBiz])

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pattern || !form.categoryId) return
    setLoading(true)
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, businessId: activeBiz, priority: Number(form.priority) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    setRules(r => [...r, data])
    setForm({ pattern: '', categoryId: '', priority: '0', field: 'description', deductibility: '' })
    toast(t('rules.added'), 'success')
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(t('common.error'), 'error'); return }
    setRules(r => r.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">{t('rules.info')}</p>
      </div>

      {/* Add rule form */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">{t('rules.add')}</h2>
        <form onSubmit={addRule} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('rules.patternLabel')}</label>
            <input
              className="input"
              placeholder="Amazon, Google Ads, Starbucks..."
              value={form.pattern}
              onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">{t('rules.field')}</label>
            <select className="input" value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))}>
              <option value="description">{t('tx.description')}</option>
              <option value="amount">{t('tx.amount')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('rules.category')}</label>
            <select className="input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
              <option value="">{t('common.select')}</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('tx.deductible')}</label>
            <select className="input" value={form.deductibility} onChange={e => setForm(f => ({ ...f, deductibility: e.target.value }))}>
              <option value="">{t('common.notSet')}</option>
              <option value="YES">{t('common.yes100')}</option>
              <option value="NO">{t('common.no')}</option>
              <option value="FIFTY">{t('common.fifty')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('rules.priority')}</label>
            <input type="number" className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? t('rules.adding') : t('rules.add')}
            </button>
          </div>
        </form>
      </div>

      {/* Rules list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{t('rules.activeRules')}</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('rules.pattern')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('rules.field')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('rules.category')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.deductible')}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('rules.priority')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">{t('rules.noRules')}</td></tr>
            )}
            {rules.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs bg-gray-50 text-gray-700">"{r.pattern}"</td>
                <td className="px-4 py-3 text-gray-600">{r.field}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{r.category?.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.deductibility || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.priority}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteRule(r.id)} className="text-xs text-red-500 hover:underline">{t('rules.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AILearnedRules({ activeBiz, categories, t, toast }: {
  activeBiz: string
  categories: any[]
  t: (k: any, v?: any) => string
  toast: (m: string, type?: any) => void
}) {
  const [patterns, setPatterns] = useState<LearnedPattern[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loadingPatterns, setLoadingPatterns] = useState(false)

  useEffect(() => {
    if (!activeBiz) return
    setLoadingPatterns(true)

    Promise.all([
      fetch(`/api/transactions?businessId=${activeBiz}&limit=500&status=CLASSIFIED`).then(r => r.json()),
      fetch(`/api/rules?businessId=${activeBiz}`).then(r => r.json()),
    ]).then(([txData, rulesData]) => {
      if (Array.isArray(rulesData)) setRules(rulesData)

      const txs: any[] = Array.isArray(txData.transactions) ? txData.transactions : []
      const manualTxs = txs.filter(tx => tx.method === 'MANUAL' && tx.categoryId && tx.category)

      // Group by first word(s) of description + category
      const grouped: Record<string, { categoryName: string; categoryId: string; count: number; lastSeen: string }> = {}
      for (const tx of manualTxs) {
        const words = tx.description.trim().toUpperCase().split(/\s+/)
        const key = words.slice(0, 2).join(' ')
        const existing = grouped[key]
        if (!existing) {
          grouped[key] = { categoryName: tx.category.name, categoryId: tx.categoryId, count: 1, lastSeen: tx.date }
        } else if (existing.categoryId === tx.categoryId) {
          existing.count++
          if (new Date(tx.date) > new Date(existing.lastSeen)) existing.lastSeen = tx.date
        }
      }

      const learned: LearnedPattern[] = Object.entries(grouped)
        .filter(([, v]) => v.count >= 2)
        .map(([pattern, v]) => ({ pattern, ...v }))
        .sort((a, b) => b.count - a.count)

      setPatterns(learned)
      setLoadingPatterns(false)
    }).catch(() => setLoadingPatterns(false))
  }, [activeBiz])

  async function confirmAsRule(p: LearnedPattern) {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBiz, pattern: p.pattern, categoryId: p.categoryId, priority: 10, field: 'description' }),
    })
    if (!res.ok) { toast(t('common.error'), 'error'); return }
    const data = await res.json()
    setRules(r => [...r, data])
    toast(t('rules.added'), 'success')
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(t('common.error'), 'error'); return }
    setRules(r => r.filter(x => x.id !== id))
    toast(t('common.success'), 'info')
  }

  const confirmedPatterns = new Set(rules.map(r => r.pattern.toUpperCase()))

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="card p-4 bg-[#1B4965]/5 border-[#1B4965]/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-sm font-semibold text-[#1B4965]">{t('rules.learnedDesc')}</p>
            <p className="text-xs text-gray-500 mt-1">{t('rules.learnedHint')}</p>
          </div>
        </div>
      </div>

      {/* Learned patterns */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{t('rules.learned')}</h3>
          <span className="text-xs text-gray-400">{patterns.length} {t('common.transactions')}</span>
        </div>

        {loadingPatterns ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : patterns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">{t('rules.noLearned')}</p>
            <p className="text-gray-300 text-xs mt-1">{t('rules.learnedHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {patterns.map(p => {
              const isConfirmed = confirmedPatterns.has(p.pattern)
              return (
                <div key={p.pattern} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">"{p.pattern}"</span>
                      {isConfirmed && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✓ {t('rules.activeRules')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">→ {p.categoryName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">{t('rules.appliedTo').replace('{n}', String(p.count))}</span>
                    </div>
                  </div>
                  {!isConfirmed ? (
                    <button
                      onClick={() => confirmAsRule(p)}
                      className="text-xs bg-[#1B4965] text-white px-3 py-1.5 rounded-lg hover:bg-[#143A52] transition-colors font-medium flex-shrink-0"
                    >
                      {t('rules.confirmRule')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const rule = rules.find(r => r.pattern.toUpperCase() === p.pattern)
                        if (rule) deleteRule(rule.id)
                      }}
                      className="text-xs text-red-500 hover:underline flex-shrink-0"
                    >
                      {t('rules.disable')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Active confirmed rules */}
      {rules.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">{t('rules.activeRules')}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('rules.pattern')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('rules.category')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('rules.priority')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">"{r.pattern}"</td>
                  <td className="px-4 py-3 text-gray-800">{r.category?.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.priority}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteRule(r.id)} className="text-xs text-red-500 hover:underline">{t('rules.disable')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RulesPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const toast = useToast()
  const { activeBizId: activeBiz } = useActiveBiz()
  const [categories, setCategories] = useState<any[]>([])

  const plan = (session?.user as any)?.plan || 'BASIC'
  const isAIPlan = plan === 'PLUS' || plan === 'ENTERPRISE'

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategories(d)
    })
  }, [activeBiz])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('rules.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAIPlan ? t('rules.plusPlan') : t('rules.basicPlan')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isAIPlan && (
            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium">
              {t('rules.upgrade')}
            </span>
          )}
        </div>
      </div>

      {activeBiz && (
        isAIPlan
          ? <AILearnedRules activeBiz={activeBiz} categories={categories} t={t} toast={toast} />
          : <ManualRules activeBiz={activeBiz} categories={categories} t={t} toast={toast} />
      )}
    </div>
  )
}
