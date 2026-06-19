'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'badge-pending',
  CLASSIFIED: 'badge-classified',
  NEEDS_REVIEW: 'badge-needs-review',
}

export default function TransactionsPage() {
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
  const [editTx, setEditTx] = useState<any>(null)
  const [splitTx, setSplitTx] = useState<any>(null)
  const [splitRows, setSplitRows] = useState([{ categoryId: '', amount: '', deductibility: '' }])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(data => {
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
    setEditTx(null)
    loadTransactions()
  }

  async function deleteTx(id: string) {
    if (!confirm('Delete this transaction?')) return
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

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <button onClick={classifyWithAI} disabled={aiLoading} className="btn-primary text-sm disabled:opacity-50">
              {aiLoading ? 'Classifying...' : `AI Classify (${selected.size})`}
            </button>
          )}
          <button onClick={selectPending} className="btn-secondary text-sm">Select Pending</button>
          {businesses.length > 1 && (
            <select className="input w-auto text-sm" value={activeBiz} onChange={e => { setActiveBiz(e.target.value); setPage(1) }}>
              {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {aiResult && (
        <div className="card p-4 bg-green-50 border-green-200">
          <p className="text-sm text-green-800">
            AI classified {aiResult.autoClassified} automatically, {aiResult.needsReview} need review.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-auto text-sm" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CLASSIFIED">Classified</option>
          <option value="NEEDS_REVIEW">Needs Review</option>
        </select>
        <select className="input w-auto text-sm" value={filters.categoryId} onChange={e => { setFilters(f => ({ ...f, categoryId: e.target.value })); setPage(1) }}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="input w-auto text-sm" value={filters.from} onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1) }} />
        <input type="date" className="input w-auto text-sm" value={filters.to} onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1) }} />
        <button onClick={() => { setFilters({ status: '', categoryId: '', from: '', to: '' }); setPage(1) }} className="btn-secondary text-sm">Clear</button>
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
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deduct.</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No transactions found</td></tr>
              )}
              {transactions.map((tx: any) => (
                <tr key={tx.id} className={`hover:bg-gray-50 ${selected.has(tx.id) ? 'bg-yellow-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <p className="truncate text-gray-800">{tx.description}</p>
                    {tx.aiSuggestion && tx.status === 'NEEDS_REVIEW' && (
                      <p className="text-xs text-blue-500">AI: {tx.aiSuggestion} ({tx.aiConfidence})</p>
                    )}
                    {tx.splits?.length > 0 && (
                      <p className="text-xs text-purple-500">Split ({tx.splits.length} parts)</p>
                    )}
                  </td>
                  <td className={`px-3 py-3 text-right font-medium whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-green-700' : 'text-gray-800'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white max-w-[160px]"
                      value={tx.categoryId || ''}
                      onChange={e => updateTx(tx.id, { categoryId: e.target.value || null, status: 'CLASSIFIED', method: 'MANUAL' })}
                    >
                      <option value="">— unassigned —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span className={STATUS_COLORS[tx.status] || 'badge-pending'}>{tx.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      value={tx.deductibility || ''}
                      onChange={e => updateTx(tx.id, { deductibility: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="YES">Yes</option>
                      <option value="NO">No</option>
                      <option value="FIFTY">50%</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSplitTx(tx); setSplitRows([{ categoryId: '', amount: String(tx.amount / 2), deductibility: '' }, { categoryId: '', amount: String(tx.amount / 2), deductibility: '' }]) }} className="text-xs text-purple-600 hover:underline px-1">Split</button>
                      <button onClick={() => deleteTx(tx.id)} className="text-xs text-red-500 hover:underline px-1">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{total} transactions</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Prev</button>
              <span className="text-xs text-gray-500 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Split Modal */}
      {splitTx && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Split Transaction</h3>
            <p className="text-sm text-gray-500 mb-4">{splitTx.description} — {fmt(splitTx.amount)}</p>
            <div className="space-y-3">
              {splitRows.map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <select className="input col-span-1 text-sm" value={row.categoryId} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, categoryId: e.target.value } : r))}>
                    <option value="">Category</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" className="input text-sm" placeholder="Amount" value={row.amount} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} />
                  <select className="input text-sm" value={row.deductibility} onChange={e => setSplitRows(rows => rows.map((r, j) => j === i ? { ...r, deductibility: e.target.value } : r))}>
                    <option value="">Deduct.</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                    <option value="FIFTY">50%</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-between">
              <button onClick={() => setSplitRows(r => [...r, { categoryId: '', amount: '', deductibility: '' }])} className="btn-secondary text-sm">+ Add Row</button>
              <div className="flex gap-2">
                <button onClick={() => setSplitTx(null)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={saveSplit} className="btn-primary text-sm">Save Split</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
