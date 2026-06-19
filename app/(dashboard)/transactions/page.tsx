'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function TransactionsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const searchParams = useSearchParams()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<string>('')
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    categoryId: '',
    from: '',
    to: '',
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [splitTx, setSplitTx] = useState<any>(null)
  const [splitRows, setSplitRows] = useState([{ categoryId: '', amount: '', deductibility: '' }])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

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
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.json()).then(setCategories)
  }, [activeBiz])

  const loadTransactions = useCallback(async () => {
    if (!activeBiz) return
    setLoading(true)
    const params = new URLSearchParams({ businessId: activeBiz, page: String(page), limit: '25' })
    if (filters.status) params.set('status', filters.status)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const data = await fetch(`/api/transactions?${params}`).then(r => r.json())
    setTransactions(data.transactions || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [activeBiz, page, filters])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  async function updateTx(id: string, patch: any) {
    await fetch(`/api/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    loadTransactions()
  }

  async function deleteTx(id: string) {
    if (!confirm(t('tx.delConfirm'))) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    loadTransactions()
  }

  async function classifyWithAI() {
    if (!selected.size) return
    setAiLoading(true)
    setAiResult(null)
    const res = await fetch('/api/classify-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBiz, transactionIds: Array.from(selected) }),
    })
    const data = await res.json()
    setAiResult(data)
    setAiLoading(false)
    setSelected(new Set())
    loadTransactions()
  }

  async function saveSplit() {
    const validSplits = splitRows.filter(r => r.categoryId && r.amount)
    if (!validSplits.length) return
    await updateTx(splitTx.id, { splits: validSplits, status: 'CLASSIFIED', method: 'MANUAL' })
    setSplitTx(null)
    setSplitRows([{ categoryId: '', amount: '', deductibility: '' }])
    toast(t('tx.saveSplit'), 'success')
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function selectPending() {
    const pendingIds = transactions.filter(t => t.status === 'PENDING').map((t: any) => t.id)
    setSelected(new Set(pendingIds))
  }

  const LIMIT = 25
  const totalPages = Math.ceil(total / LIMIT)

  const statusLabel: Record<string, string> = {
    PENDING: t('tx.pending'),
    CLASSIFIED: t('tx.classified'),
    NEEDS_REVIEW: t('tx.needsReview'),
  }

  const statusColors: Record<string, string> = {
    PENDING: 'badge-pending',
    CLASSIFIED: 'badge-classified',
    NEEDS_REVIEW: 'badge-needs-review',
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('nav.transactions')}</h1>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <button onClick={classifyWithAI} disabled={aiLoading} className="btn-primary text-sm disabled:opacity-50">
              {aiLoading ? t('tx.classifying') : t('tx.aiClassifyCount').replace('{n}', String(selected.size))}
            </button>
          )}
          <button onClick={selectPending} className="btn-secondary text-sm">{t('tx.selectPending')}</button>
          {businesses.length > 1 && (
            <select className="input w-auto text-sm" value={activeBiz} onChange={e => { setActiveBiz(e.target.value); setPage(1) }}>
              {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {aiResult && (
        <div className="card p-4 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">
            {t('tx.aiSuccess').replace('{auto}', aiResult.autoClassified).replace('{review}', aiResult.needsReview)}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-auto text-sm" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}>
          <option value="">{t('tx.allStatus')}</option>
          <option value="PENDING">{t('tx.pending')}</option>
          <option value="CLASSIFIED">{t('tx.classified')}</option>
          <option value="NEEDS_REVIEW">{t('tx.needsReview')}</option>
        </select>
        <select className="input w-auto text-sm" value={filters.categoryId} onChange={e => { setFilters(f => ({ ...f, categoryId: e.target.value })); setPage(1) }}>
          <option value="">{t('tx.allCategories')}</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="input w-auto text-sm" value={filters.from} onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1) }} />
        <input type="date" className="input w-auto text-sm" value={filters.to} onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1) }} />
        <button onClick={() => { setFilters({ status: '', categoryId: '', from: '', to: '' }); setPage(1) }} className="btn-secondary text-sm">{t('common.clear')}</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(transactions.map((t: any) => t.id)) : new Set())} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.date')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.description')}</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('tx.amount')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.category')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.status')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.deductible')}</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('tx.noData')}</td></tr>
              )}
              {transactions.map((tx: any) => (
                <tr key={tx.id} className={`hover:bg-gray-50 ${selected.has(tx.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <p className="truncate text-gray-800">{tx.description}</p>
                    {tx.aiSuggestion && tx.status === 'NEEDS_REVIEW' && (
                      <p className="text-xs text-blue-500">
                        {t('tx.aiSuggestion').replace('{cat}', tx.aiSuggestion).replace('{conf}', tx.aiConfidence || '')}
                      </p>
                    )}
                    {tx.splits?.length > 0 && (
                      <p className="text-xs text-purple-500">
                        {t('tx.splitParts').replace('{n}', tx.splits.length)}
                      </p>
                    )}
                  </td>
                  <td className={`px-3 py-3 text-right font-medium whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-700' : 'text-gray-800'}`}>
                    {tx.type === 'CREDIT' ? '+' : '−'}{fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white max-w-[160px]"
                      value={tx.categoryId || ''}
                      onChange={e => updateTx(tx.id, { categoryId: e.target.value || null, status: 'CLASSIFIED', method: 'MANUAL' })}
                    >
                      <option value="">{t('tx.unassigned')}</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span className={statusColors[tx.status] || 'badge-pending'}>{statusLabel[tx.status] || tx.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      value={tx.deductibility || ''}
                      onChange={e => updateTx(tx.id, { deductibility: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="YES">{t('common.yes100')}</option>
                      <option value="NO">{t('common.no')}</option>
                      <option value="FIFTY">{t('common.fifty')}</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSplitTx(tx)
                          setSplitRows([
                            { categoryId: '', amount: String((tx.amount / 2).toFixed(2)), deductibility: '' },
                            { categoryId: '', amount: String((tx.amount / 2).toFixed(2)), deductibility: '' },
                          ])
                        }}
                        className="text-xs text-purple-600 hover:underline px-1"
                      >
                        {t('tx.split')}
                      </button>
                      <button onClick={() => deleteTx(tx.id)} className="text-xs text-red-500 hover:underline px-1">{t('common.del')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{t('tx.total').replace('{total}', String(total))}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">{t('tx.prev')}</button>
              <span className="text-xs text-gray-500 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">{t('tx.next')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Split Modal */}
      {splitTx && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">{t('tx.splitTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">{splitTx.description} — {fmt(splitTx.amount)}</p>
            <div className="space-y-3">
              {splitRows.map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <select className="input col-span-1 text-sm" value={row.categoryId} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, categoryId: e.target.value } : r))}>
                    <option value="">{t('tx.category')}</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" className="input text-sm" placeholder={t('tx.amount')} value={row.amount} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} />
                  <select className="input text-sm" value={row.deductibility} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, deductibility: e.target.value } : r))}>
                    <option value="">{t('tx.deductible')}</option>
                    <option value="YES">{t('common.yes100')}</option>
                    <option value="NO">{t('common.no')}</option>
                    <option value="FIFTY">{t('common.fifty')}</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-between">
              <button onClick={() => setSplitRows(r => [...r, { categoryId: '', amount: '', deductibility: '' }])} className="btn-secondary text-sm">{t('tx.addRow')}</button>
              <div className="flex gap-2">
                <button onClick={() => setSplitTx(null)} className="btn-secondary text-sm">{t('common.cancel')}</button>
                <button onClick={saveSplit} className="btn-primary text-sm">{t('tx.saveSplit')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
