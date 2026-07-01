'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

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
  transactionId?: string
  extracted?: ExtractedData
  mimeType?: string
  form: {
    merchant: string
    date: string
    amount: string
    categoryId: string
    deductibility: string
    notes: string
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

export default function RecibosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const { activeBizId: activeBiz } = useActiveBiz()
  const [categories, setCategories] = useState<any[]>([])
  const [jobs, setJobs] = useState<ScanJob[]>([])

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCategories(d)
    })
  }, [activeBiz])

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
    const tooBig = valid.filter(f => f.size > 10 * 1024 * 1024)
    if (tooBig.length > 0) { toast(t('receipts.tooLarge'), 'error'); return }

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
    for (const job of newJobs) scanFile(job)
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
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'confirmed', preview: '' } : j))
    toast(t('receipts.confirmed'), 'success')
  }

  async function rejectJob(job: ScanJob) {
    if (!confirm(t('receipts.rejectConfirm'))) return
    if (job.transactionId) {
      await fetch(`/api/transactions/${job.transactionId}`, { method: 'DELETE' })
    }
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'rejected', preview: '' } : j))
    toast(t('receipts.rejected'), 'info')
  }

  function updateForm(jobId: string, field: string, value: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, form: { ...j.form, [field]: value } } : j))
  }

  const pending = jobs.filter(j => j.status === 'scanning' || j.status === 'review')
  const done = jobs.filter(j => j.status === 'confirmed' || j.status === 'rejected' || j.status === 'error')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('receipts.title')}</h1>

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

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFileInput} className="hidden" />
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif" multiple onChange={onFileInput} className="hidden" />

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
  )
}

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
        <div className="flex justify-center">
          {job.preview
            ? <img src={job.preview} alt="Receipt preview" className="max-h-64 object-contain rounded-lg border border-gray-100" />
            : <div className="w-full h-40 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 text-4xl">📄</div>
          }
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{t('receipts.merchant')}</label>
            <input className="input text-sm" value={job.form.merchant} onChange={e => onFormChange(job.id, 'merchant', e.target.value)} placeholder={t('receipts.merchantPlaceholder')} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('tx.date')}</label>
              <input type="date" className="input text-sm" value={job.form.date} onChange={e => onFormChange(job.id, 'date', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('tx.amount')}</label>
              <input type="number" step="0.01" className="input text-sm" value={job.form.amount} onChange={e => onFormChange(job.id, 'amount', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="label">{t('tx.category')}</label>
            <select className="input text-sm" value={job.form.categoryId} onChange={e => onFormChange(job.id, 'categoryId', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">{t('receipts.deductibility')}</label>
            <select className="input text-sm" value={job.form.deductibility} onChange={e => onFormChange(job.id, 'deductibility', e.target.value)}>
              <option value="YES">{t('common.yes100')}</option>
              <option value="NO">{t('common.no')}</option>
              <option value="FIFTY">{t('common.fifty')}</option>
            </select>
          </div>

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
            <button onClick={() => onConfirm(job)} className="btn-primary flex-1 text-sm py-2">{t('receipts.confirm')}</button>
            <button onClick={() => onReject(job)} className="btn-secondary text-sm py-2 px-4 text-red-600 border-red-200 hover:bg-red-50">{t('receipts.reject')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
