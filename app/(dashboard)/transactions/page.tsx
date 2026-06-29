'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function TransactionsContent() {
  const { t } = useTranslation()
  const toast = useToast()
  const searchParams = useSearchParams()
  const selectAllRef = useRef<HTMLInputElement>(null)

  const { activeBizId: activeBiz } = useActiveBiz()
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [idsFilter] = useState<string>(searchParams.get('ids') || '')
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    categoryId: '',
    type: '',
    from: '',
    to: '',
    search: '',
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [splitTx, setSplitTx] = useState<any>(null)
  const [splitRows, setSplitRows] = useState([{ categoryId: '', amount: '', deductibility: '' }])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.ok ? r.json() : []).then(setCategories)
  }, [activeBiz])

  const loadTransactions = useCallback(async (pageNum: number, append: boolean) => {
    if (!activeBiz) return
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: activeBiz, page: String(pageNum), limit: '25' })
      if (idsFilter) {
        params.set('ids', idsFilter)
      } else {
        if (filters.status) params.set('status', filters.status)
        if (filters.categoryId) params.set('categoryId', filters.categoryId)
        if (filters.type) params.set('type', filters.type)
        if (filters.from) params.set('from', filters.from)
        if (filters.to) params.set('to', filters.to)
        if (filters.search) params.set('search', filters.search)
      }
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const newTxs = Array.isArray(data.transactions) ? data.transactions : []
      setTransactions(prev => append ? [...prev, ...newTxs] : newTxs)
      setTotal(data.total || 0)
      setHasMore(newTxs.length === 25)
    } catch (err) {
      console.error('Failed to load transactions:', err)
      if (!append) setTransactions([])
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [activeBiz, filters])

  // Reset and reload when filters or business change
  useEffect(() => {
    setPage(1)
    setTransactions([])
    loadTransactions(1, false)
  }, [activeBiz, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load more when page increments
  useEffect(() => {
    if (page === 1) return
    loadTransactions(page, true)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(p => p + 1)
      }
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading])

  // Sync select-all checkbox indeterminate state
  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const allSelected = transactions.length > 0 && selected.size === transactions.length
    const someSelected = selected.size > 0 && selected.size < transactions.length
    el.checked = allSelected
    el.indeterminate = someSelected
  }, [selected, transactions])

  async function updateTx(id: string, patch: any) {
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      loadTransactions(1, false)
    } catch (err) {
      console.error('Update failed:', err)
      toast(t('common.operationError'), 'error')
    }
  }

  async function deleteTx(id: string) {
    if (!confirm(t('tx.delConfirm'))) return
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      loadTransactions(1, false)
      toast(t('tx.deleted'), 'success')
    } catch (err) {
      console.error('Delete failed:', err)
      toast(t('common.operationError'), 'error')
    }
  }

  async function bulkDelete() {
    if (!selected.size) return
    if (!confirm(t('tx.delBulkConfirm').replace('{n}', String(selected.size)))) return
    const count = selected.size
    setDeleteLoading(true)
    try {
      const results = await Promise.all(Array.from(selected).map(id => fetch(`/api/transactions/${id}`, { method: 'DELETE' })))
      const failed = results.filter(r => !r.ok).length
      setSelected(new Set())
      if (failed > 0) toast(t('tx.delBulkPartial').replace('{ok}', String(count - failed)).replace('{fail}', String(failed)), 'error')
      else toast(t('tx.delBulkSuccess').replace('{n}', String(count)), 'success')
      loadTransactions(1, false)
    } catch (err) {
      console.error('Bulk delete failed:', err)
      toast(t('common.operationError'), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function bulkClassify() {
    if (!selected.size || !bulkCategoryId) return
    setBulkLoading(true)
    try {
      const results = await Promise.all(
        Array.from(selected).map(id =>
          fetch(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: bulkCategoryId, status: 'CLASSIFIED', method: 'MANUAL' }),
          })
        )
      )
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        toast(t('tx.nClassifyErrors').replace('{n}', String(failed)), 'error')
      } else {
        toast(t('tx.nClassified').replace('{n}', String(selected.size)), 'success')
      }
      setSelected(new Set())
      setBulkCategoryId('')
      loadTransactions(1, false)
    } catch (err) {
      console.error('Bulk classify failed:', err)
      toast(t('common.operationError'), 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  async function classifyWithAI() {
    if (!selected.size) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/classify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBiz, transactionIds: Array.from(selected) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAiResult(data)
      setSelected(new Set())
      loadTransactions(1, false)
      toast(t('tx.aiDone'), 'success')
    } catch (err) {
      console.error('AI classify failed:', err)
      toast(t('tx.aiError'), 'error')
    } finally {
      setAiLoading(false)
    }
  }

  async function saveSplit() {
    const validSplits = splitRows.filter(r => r.categoryId && r.amount)
    if (!validSplits.length) {
      toast(t('tx.splitCatRequired'), 'error')
      return
    }
    const splitTotal = validSplits.reduce((s, r) => s + Number(r.amount), 0)
    if (Math.abs(splitTotal - splitTx.amount) > 0.01) {
      toast(t('tx.splitTotalMismatch'), 'error')
      return
    }
    try {
      await updateTx(splitTx.id, { splits: validSplits, status: 'CLASSIFIED', method: 'MANUAL' })
      setSplitTx(null)
      setSplitRows([{ categoryId: '', amount: '', deductibility: '' }])
    } catch (err) {
      console.error('Save split failed:', err)
    }
  }

  async function downloadPDF() {
    if (!activeBiz) return
    setPdfLoading(true)
    try {
      const params = new URLSearchParams({ businessId: activeBiz, limit: '1000' })
      if (idsFilter) {
        params.set('ids', idsFilter)
      } else {
        if (filters.status) params.set('status', filters.status)
        if (filters.categoryId) params.set('categoryId', filters.categoryId)
        if (filters.type) params.set('type', filters.type)
        if (filters.from) params.set('from', filters.from)
        if (filters.to) params.set('to', filters.to)
        if (filters.search) params.set('search', filters.search)
      }
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      const txs: any[] = data.transactions || []
      if (!txs.length) { toast('No hay transacciones para exportar', 'error'); return }

      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFillColor(27, 73, 101)
      doc.rect(0, 0, 297, 20, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      const title = filters.search ? `Transacciones: "${filters.search}"` : 'Transacciones'
      doc.text(title, 14, 8)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date().toLocaleDateString('es'), 14, 15)

      const income = txs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
      const expenses = txs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`Ingresos: ${fmt(income)}`, 14, 28)
      doc.text(`Gastos: ${fmt(expenses)}`, 90, 28)
      doc.text(`Neto: ${fmt(income - expenses)}`, 170, 28)
      doc.text(`Total: ${txs.length} transacciones`, 230, 28)

      autoTable(doc, {
        startY: 33,
        head: [['Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría', 'Estado', 'Deducible']],
        body: txs.map(tx => [
          tx.date ? new Date(tx.date).toLocaleDateString('es') : '',
          tx.description?.substring(0, 50) || '',
          fmt(tx.amount),
          tx.type === 'CREDIT' ? 'Ingreso' : 'Gasto',
          tx.category?.name || '—',
          tx.status === 'CLASSIFIED' ? 'Clasificada' : tx.status === 'PENDING' ? 'Pendiente' : 'Revisar',
          tx.deductibility === 'YES' ? '100%' : tx.deductibility === 'FIFTY' ? '50%' : 'No',
        ]),
        headStyles: { fillColor: [27, 73, 101], fontSize: 7 },
        bodyStyles: { fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 85 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 62 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 18, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const tx = txs[data.row.index]
            data.cell.styles.textColor = tx?.type === 'CREDIT' ? [5, 150, 105] : [220, 38, 38]
          }
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      })

      const suffix = filters.search ? `-${filters.search.replace(/\s+/g, '_')}` : ''
      doc.save(`transacciones${suffix}-${new Date().toISOString().split('T')[0]}.pdf`)
      toast('PDF descargado', 'success')
    } catch (err) {
      console.error('PDF download failed:', err)
      toast('Error al generar PDF', 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(transactions.map((t: any) => t.id)) : new Set())
  }

  function selectPending() {
    const pendingIds = transactions.filter(tx => tx.status === 'PENDING').map((tx: any) => tx.id)
    setSelected(new Set(pendingIds))
  }

  const LIMIT = 25

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
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('nav.transactions')}</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={selectPending} className="btn-secondary text-sm">{t('tx.selectPending')}</button>
          <button onClick={downloadPDF} disabled={pdfLoading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {pdfLoading ? 'Generando...' : 'PDF'}
          </button>
        </div>
      </div>

      {aiResult && (
        <div className="card p-4 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">
            {t('tx.aiSuccess').replace('{auto}', aiResult.autoClassified).replace('{review}', aiResult.needsReview)}
          </p>
        </div>
      )}

      {/* Banner when viewing specific imported batch */}
      {idsFilter && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center justify-between gap-3">
          <span>Mostrando solo las transacciones recién importadas ({total})</span>
          <a href="/transactions" className="text-blue-600 font-medium hover:underline text-xs">Ver todas</a>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 bg-white focus-within:ring-2 focus-within:ring-[#1B4965] focus-within:border-transparent">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('tx.searchPlaceholder')}
            className="flex-1 text-sm py-2 outline-none bg-transparent"
            value={searchInput}
            onChange={e => {
              const val = e.target.value
              setSearchInput(val)
              if (searchTimer.current) clearTimeout(searchTimer.current)
              searchTimer.current = setTimeout(() => {
                setFilters(f => ({ ...f, search: val }))
                setPage(1)
              }, 400)
            }}
          />
        </div>
        <select className="input w-auto text-sm" value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1) }}>
          <option value="">Ingresos y Gastos</option>
          <option value="CREDIT">Solo Ingresos</option>
          <option value="DEBIT">Solo Gastos</option>
        </select>
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
        <button onClick={() => { setSearchInput(''); setFilters({ status: '', categoryId: '', type: '', from: '', to: '', search: '' }); setPage(1) }} className="btn-secondary text-sm">{t('common.clear')}</button>
      </div>

      {/* Bulk action bar — appears above table when items are selected */}
      {selected.size > 0 && (
        <div className="card p-3 bg-[#1B4965]/5 border-[#1B4965]/20 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-[#1B4965]">{t('tx.selected').replace('{n}', String(selected.size))}</span>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <select
              className="input w-auto text-sm py-1"
              value={bulkCategoryId}
              onChange={e => setBulkCategoryId(e.target.value)}
            >
              <option value="">{t('tx.classifyAs')}</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={bulkClassify} disabled={!bulkCategoryId || bulkLoading} className="btn-primary text-sm py-1 px-3 disabled:opacity-40">
              {bulkLoading ? t('common.loading') : t('tx.apply')}
            </button>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <button onClick={classifyWithAI} disabled={aiLoading} className="btn-primary text-sm py-1 disabled:opacity-50">
            {aiLoading ? t('tx.classifying') : `${t('tx.aiClassify')} (${selected.size})`}
          </button>
          <div className="h-4 w-px bg-gray-300" />
          <button onClick={bulkDelete} disabled={deleteLoading} className="text-sm text-red-600 font-medium hover:text-red-800 disabled:opacity-50">
            {deleteLoading ? t('common.loading') : t('tx.deleteCount').replace('{n}', String(selected.size))}
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    onChange={e => toggleAll(e.target.checked)}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.date')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.description')}</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('tx.amount')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.category')}</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.status')}</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      {t('common.loading')}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-gray-400 text-sm">{t('tx.noData')}</p>
                    {(filters.search || filters.status || filters.categoryId || filters.from || filters.to) && (
                      <p className="text-xs text-gray-300 mt-1">{t('tx.noDataFilters')}</p>
                    )}
                  </td>
                </tr>
              )}
              {transactions.map((tx: any) => (
                <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${selected.has(tx.id) ? 'bg-blue-50/70' : ''}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="truncate text-gray-800 text-sm">{tx.description}</p>
                    {tx.aiSuggestion && tx.status === 'NEEDS_REVIEW' && (
                      <p className="text-xs text-blue-500 truncate">
                        {t('tx.aiSuggestion').replace('{cat}', tx.aiSuggestion).replace('{conf}', tx.aiConfidence || '')}
                      </p>
                    )}
                    {tx.splits?.length > 0 && (
                      <p className="text-xs text-purple-500">
                        {t('tx.splitParts').replace('{n}', tx.splits.length)}
                      </p>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap text-sm ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'CREDIT' ? '+' : '−'}{fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white max-w-[160px]"
                      value={tx.categoryId || ''}
                      onChange={e => updateTx(tx.id, { categoryId: e.target.value || null, status: 'CLASSIFIED', method: 'MANUAL' })}
                    >
                      <option value="">{t('tx.unassigned')}</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={statusColors[tx.status] || 'badge-pending'}>{statusLabel[tx.status] || tx.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSplitTx(tx)
                          setSplitRows([
                            { categoryId: '', amount: String((tx.amount / 2).toFixed(2)), deductibility: '' },
                            { categoryId: '', amount: String((tx.amount / 2).toFixed(2)), deductibility: '' },
                          ])
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {t('tx.split')}
                      </button>
                      <button onClick={() => deleteTx(tx.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('common.del')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">{t('tx.total').replace('{total}', String(total))}</p>
          <p className="text-xs text-gray-400">{t('tx.xOf').replace('{x}', String(transactions.length)).replace('{total}', String(total))}</p>
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 py-4 text-gray-400 text-sm">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            {t('tx.loadingMore')}
          </div>
        )}
        {!hasMore && transactions.length > 0 && !loading && (
          <p className="text-center text-xs text-gray-300 py-3">{t('tx.endOfList')}</p>
        )}
      </div>

      {/* Split Modal */}
      {splitTx && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
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

export default function TransactionsPage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-64 text-gray-400 text-sm">{t('common.loading')}</div>}>
      <TransactionsContent />
    </Suspense>
  )
}
