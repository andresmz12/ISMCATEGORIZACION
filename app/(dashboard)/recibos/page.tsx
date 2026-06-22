'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

// ── types ────────────────────────────────────────────────────────────
interface ExtractedData {
  merchant: string | null
  date: string | null
  total: number | null
  subtotal: number | null
  tax: number | null
  items: { description: string; amount: number }[] | null
  payment_method: string | null
  category_suggestion: string | null
  deductibility: 'YES' | 'NO' | 'FIFTY' | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface ScanJob {
  id: string
  file: File
  preview: string
  status: 'scanning' | 'review' | 'confirmed' | 'rejected' | 'error'
  error?: string
  receiptId?: string
  transactionId?: string
  extracted?: ExtractedData
  mimeType?: string
  // editable form fields
  form: {
    merchant: string
    date: string
    amount: string
    categoryId: string
    deductibility: string
    notes: string
  }
}

interface HistoryReceipt {
  id: string
  filename: string
  mimeType: string
  createdAt: string
  data: string
  transaction: {
    id: string
    description: string
    amount: number
    date: string
    status: string
    category?: { name: string }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-emerald-100 text-emerald-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[level] || 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  )
}

// ── main page ────────────────────────────────────────────────────────
export default function RecibosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<'scan' | 'history'>('scan')

  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<string>('')
  const [categories, setCategories] = useState<any[]>([])
  const [jobs, setJobs] = useState<ScanJob[]>([])

  // history
  const [history, setHistory] = useState<HistoryReceipt[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histTotal, setHistTotal] = useState(0)
  const [histPage, setHistPage] = useState(1)
  const [lightbox, setLightbox] = useState<HistoryReceipt | null>(null)

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(d => {
      if (!Array.isArray(d)) return
      setBusinesses(d)
      const saved = localStorage.getItem('activeBusiness')
      const biz = (saved && d.find((b: any) => b.id === saved)) || d[0]
      if (biz) setActiveBiz(biz.id)
    })
  }, [])

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategories(d)
    })
  }, [activeBiz])

  const loadHistory = useCallback(async (biz: string, page: number) => {
    if (!biz) return
    setHistLoading(true)
    const res = await fetch(`/api/receipts?businessId=${biz}&page=${page}&limit=20`)
    const d = await res.json()
    setHistory(d.receipts || [])
    setHistTotal(d.total || 0)
    setHistPage(page)
    setHistLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'history' && activeBiz) loadHistory(activeBiz, 1)
  }, [tab, activeBiz, loadHistory])

  // ── drag & drop ──────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function onDragLeave() { setDragging(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  async function handleFiles(files: File[]) {
    if (!activeBiz) { toast(t('receipts.selectBusiness'), 'error'); return }
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
    const valid = files.filter(f => ACCEPTED.includes(f.type) || f.name.match(/\.(jpe?g|png|webp|pdf|heic|heif)$/i))
    if (valid.length === 0) { toast(t('receipts.invalidFormat'), 'error'); return }
    const MAX_SIZE = 10 * 1024 * 1024
    const tooBig = valid.filter(f => f.size > MAX_SIZE)
    if (tooBig.length > 0) { toast(t('receipts.tooLarge'), 'error'); return }

    // Create jobs with previews
    const newJobs: ScanJob[] = await Promise.all(valid.map(async (file) => {
      const preview = file.type.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif)$/i)
        ? await new Promise<string>(resolve => {
            const r = new FileReader()
            r.onload = e => resolve(e.target?.result as string)
            r.readAsDataURL(file)
          })
        : ''
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        status: 'scanning' as const,
        form: { merchant: '', date: '', amount: '', categoryId: '', deductibility: '', notes: '' },
      }
    }))

    setJobs(prev => [...newJobs, ...prev])

    // Scan each file
    for (const job of newJobs) {
      scanFile(job)
    }
  }

  async function scanFile(job: ScanJob) {
    try {
      const fd = new FormData()
      fd.append('businessId', activeBiz)
      fd.append('file', job.file)
      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: data.error } : j))
        return
      }

      const ex: ExtractedData = data.extracted
      const catMatch = categories.find(c => c.name === ex?.category_suggestion)

      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status: 'review',
        receiptId: data.receiptId,
        transactionId: data.transactionId,
        extracted: ex,
        mimeType: data.mimeType,
        form: {
          merchant: ex?.merchant || j.file.name,
          date: ex?.date || new Date().toISOString().split('T')[0],
          amount: ex?.total != null ? String(ex.total) : '',
          categoryId: catMatch?.id || '',
          deductibility: ex?.deductibility || 'YES',
          notes: '',
        },
      } : j))
    } catch (e: any) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: e.message } : j))
    }
  }

  async function confirmJob(job: ScanJob) {
    if (!job.transactionId) return
    const res = await fetch(`/api/transactions/${job.transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: job.form.merchant || job.extracted?.merchant || job.file.name,
        status: 'CLASSIFIED',
        categoryId: job.form.categoryId || undefined,
        deductibility: job.form.deductibility || undefined,
        notes: job.form.notes || undefined,
        method: 'MANUAL',
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast(d.error || t('common.error'), 'error')
      return
    }
    // Also update date/amount if changed
    const patchBody: any = {}
    if (job.form.date) patchBody.date = job.form.date
    // NOTE: amount can't be changed via PATCH without description — we accept the extracted value
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'confirmed' } : j))
    toast(t('receipts.confirmed'), 'success')
  }

  async function rejectJob(job: ScanJob) {
    if (!confirm(t('receipts.rejectConfirm'))) return
    if (job.transactionId) {
      await fetch(`/api/transactions/${job.transactionId}`, { method: 'DELETE' })
    }
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'rejected' } : j))
    toast(t('receipts.rejected'), 'info')
  }

  function updateForm(jobId: string, field: string, value: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, form: { ...j.form, [field]: value } } : j))
  }

  const pending = jobs.filter(j => j.status === 'scanning' || j.status === 'review')
  const done = jobs.filter(j => j.status === 'confirmed' || j.status === 'rejected' || j.status === 'error')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('receipts.title')}</h1>
        {businesses.length > 1 && (
          <select className="input w-auto text-sm" value={activeBiz} onChange={e => setActiveBiz(e.target.value)}>
            {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['scan', 'history'] as const).map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t2 ? 'border-[#1B4965] text-[#1B4965]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t2 === 'scan' ? t('receipts.scan') : t('receipts.history')}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="space-y-6">
          {/* Upload zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragging ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-gray-200'
            }`}
          >
            <div className="text-4xl mb-3">📸</div>
            <p className="text-sm font-medium text-gray-700 mb-1">{t('receipts.dropzone')}</p>
            <p className="text-xs text-gray-400 mb-4">{t('receipts.formats')}</p>

            {/* Hidden inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileInput}
              className="hidden"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif"
              multiple
              onChange={onFileInput}
              className="hidden"
            />

            {/* Mobile: two buttons side by side */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1B4965] text-white rounded-xl text-sm font-semibold hover:bg-[#153d52] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Tomar foto
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Subir archivo / Galería
              </button>
            </div>
          </div>

          {/* Pending/scanning jobs */}
          {pending.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {t('receipts.reviewing')} ({pending.length})
              </h2>
              {pending.map(job => (
                <ScanCard
                  key={job.id}
                  job={job}
                  categories={categories}
                  onConfirm={confirmJob}
                  onReject={rejectJob}
                  onFormChange={updateForm}
                />
              ))}
            </div>
          )}

          {/* Done jobs (this session) */}
          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">{t('receipts.processed')}</h2>
              <div className="divide-y divide-gray-100 card overflow-hidden">
                {done.map(job => (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                    {job.preview
                      ? <img src={job.preview} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">📄</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{job.form.merchant || job.file.name}</p>
                      <p className="text-xs text-gray-400">{job.form.date} · {job.form.amount ? fmt(parseFloat(job.form.amount)) : '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      job.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                      job.status === 'rejected' ? 'bg-gray-100 text-gray-500' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {job.status === 'confirmed' ? t('receipts.confirmed') :
                       job.status === 'rejected' ? t('receipts.rejected') :
                       job.error || 'Error'}
                    </span>
                    <button onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))} className="text-gray-300 hover:text-gray-500 text-lg leading-none flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && done.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">{t('receipts.noReceipts')}</p>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {histLoading && <div className="text-center text-sm text-gray-400 py-8">{t('common.loading')}</div>}

          {!histLoading && history.length === 0 && (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">🧾</div>
              <p className="text-sm text-gray-400">{t('receipts.noHistory')}</p>
            </div>
          )}

          {!histLoading && history.length > 0 && (
            <>
              <div className="text-xs text-gray-400">{histTotal} {t('receipts.totalReceipts')}</div>
              <div className="card divide-y divide-gray-50 overflow-hidden">
                {history.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setLightbox(r)}
                  >
                    {r.mimeType?.startsWith('image/')
                      ? <img src={`data:${r.mimeType};base64,${r.data}`} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 border border-gray-100" />
                      : <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">📄</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.transaction.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(r.transaction.date).toLocaleDateString()} · {r.transaction.category?.name || '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-800">{fmt(r.transaction.amount)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        r.transaction.status === 'CLASSIFIED' ? 'bg-emerald-100 text-emerald-700' :
                        r.transaction.status === 'NEEDS_REVIEW' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {r.transaction.status === 'CLASSIFIED' ? t('tx.classified') : r.transaction.status === 'NEEDS_REVIEW' ? t('tx.needsReview') : t('tx.pending')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {histTotal > 20 && (
                <div className="flex justify-center gap-2">
                  <button
                    disabled={histPage <= 1}
                    onClick={() => loadHistory(activeBiz, histPage - 1)}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    {t('tx.prev')}
                  </button>
                  <span className="text-sm text-gray-500 self-center">
                    {histPage} / {Math.ceil(histTotal / 20)}
                  </span>
                  <button
                    disabled={histPage >= Math.ceil(histTotal / 20)}
                    onClick={() => loadHistory(activeBiz, histPage + 1)}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    {t('tx.next')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{lightbox.transaction.description}</h3>
              <button onClick={() => setLightbox(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {lightbox.mimeType?.startsWith('image/') && (
              <div className="p-4 bg-gray-50 flex justify-center">
                <img
                  src={`data:${lightbox.mimeType};base64,${lightbox.data}`}
                  alt="Receipt"
                  className="max-h-96 object-contain rounded-lg"
                />
              </div>
            )}
            <div className="p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">{t('tx.date')}:</span> <span className="font-medium">{new Date(lightbox.transaction.date).toLocaleDateString()}</span></div>
                <div><span className="text-gray-500">{t('tx.amount')}:</span> <span className="font-semibold text-gray-900">{fmt(lightbox.transaction.amount)}</span></div>
                <div><span className="text-gray-500">{t('tx.category')}:</span> <span className="font-medium">{lightbox.transaction.category?.name || '—'}</span></div>
                <div><span className="text-gray-500">{t('tx.status')}:</span> <span className="font-medium">{lightbox.transaction.status}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ScanCard component ───────────────────────────────────────────────
function ScanCard({
  job,
  categories,
  onConfirm,
  onReject,
  onFormChange,
}: {
  job: ScanJob
  categories: any[]
  onConfirm: (j: ScanJob) => void
  onReject: (j: ScanJob) => void
  onFormChange: (id: string, field: string, value: string) => void
}) {
  const { t } = useTranslation()

  if (job.status === 'scanning') {
    return (
      <div className="card p-4 flex items-center gap-4 animate-pulse">
        {job.preview
          ? <img src={job.preview} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 opacity-60" />
          : <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
        }
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="text-sm text-[#1B4965] font-medium flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t('receipts.scanning')}
        </div>
      </div>
    )
  }

  if (job.status === 'error') {
    return (
      <div className="card p-4 border-red-200 bg-red-50 flex items-center gap-4">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">{job.file.name}</p>
          <p className="text-xs text-red-500">{job.error || t('common.error')}</p>
        </div>
        <button onClick={() => onReject(job)} className="text-xs text-red-600 hover:underline">{t('common.delete')}</button>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden border border-[#1B4965]/10">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1B4965]/5 border-b border-[#1B4965]/10">
        <div className="text-sm font-semibold text-[#1B4965] flex-1 truncate">{job.file.name}</div>
        {job.extracted?.confidence && <ConfidenceBadge level={job.extracted.confidence} />}
        <span className="text-xs text-gray-400">{t('receipts.reviewLabel')}</span>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Image preview */}
        <div className="flex justify-center">
          {job.preview
            ? <img src={job.preview} alt="Receipt preview" className="max-h-64 object-contain rounded-lg border border-gray-100" />
            : <div className="w-full h-40 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 text-4xl">📄</div>
          }
        </div>

        {/* Edit form */}
        <div className="space-y-3">
          <div>
            <label className="label">{t('receipts.merchant')}</label>
            <input
              className="input text-sm"
              value={job.form.merchant}
              onChange={e => onFormChange(job.id, 'merchant', e.target.value)}
              placeholder={t('receipts.merchantPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('tx.date')}</label>
              <input
                type="date"
                className="input text-sm"
                value={job.form.date}
                onChange={e => onFormChange(job.id, 'date', e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('tx.amount')}</label>
              <input
                type="number"
                step="0.01"
                className="input text-sm"
                value={job.form.amount}
                onChange={e => onFormChange(job.id, 'amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="label">{t('tx.category')}</label>
            <select
              className="input text-sm"
              value={job.form.categoryId}
              onChange={e => onFormChange(job.id, 'categoryId', e.target.value)}
            >
              <option value="">{t('common.select')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">{t('receipts.deductibility')}</label>
            <select
              className="input text-sm"
              value={job.form.deductibility}
              onChange={e => onFormChange(job.id, 'deductibility', e.target.value)}
            >
              <option value="YES">{t('common.yes100')}</option>
              <option value="NO">{t('common.no')}</option>
              <option value="FIFTY">{t('common.fifty')}</option>
            </select>
          </div>

          {/* AI extracted details */}
          {job.extracted?.items && job.extracted.items.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-500 space-y-0.5">
              <p className="font-semibold text-gray-600 mb-1">{t('receipts.aiExtracted')}:</p>
              {job.extracted.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate pr-2">{it.description}</span>
                  <span className="flex-shrink-0">{fmt(it.amount)}</span>
                </div>
              ))}
              {job.extracted.tax && (
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span>Tax</span>
                  <span>{fmt(job.extracted.tax)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onConfirm(job)}
              className="btn-primary flex-1 text-sm py-2"
            >
              {t('receipts.confirm')}
            </button>
            <button
              onClick={() => onReject(job)}
              className="btn-secondary text-sm py-2 px-4 text-red-600 border-red-200 hover:bg-red-50"
            >
              {t('receipts.reject')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
