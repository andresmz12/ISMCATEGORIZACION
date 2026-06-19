'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'

const FIELD_KEYS = ['date', 'description', 'amount', 'debit', 'credit'] as const

export default function ImportPage() {
  const { t } = useTranslation()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [bankName, setBankName] = useState('')
  const [savedMappings, setSavedMappings] = useState<any[]>([])
  const [step, setStep] = useState<'upload' | 'map' | 'result'>('upload')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
    fetch(`/api/import?businessId=${activeBiz}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setSavedMappings(d)
    })
  }, [activeBiz])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const text = await f.text()
      const firstLine = text.split('\n')[0]
      const cols = firstLine.split(',').map(c => c.trim().replace(/"/g, ''))
      setHeaders(cols)
      autoDetectMapping(cols)
      setStep('map')
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const buffer = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]
      const cols: string[] = []
      ws.getRow(1).eachCell((cell) => cols.push(String(cell.value ?? '')))
      setHeaders(cols)
      autoDetectMapping(cols)
      setStep('map')
    } else {
      setError(t('import.formatsError'))
    }
  }

  function autoDetectMapping(cols: string[]) {
    const m: Record<string, string> = {}
    for (const col of cols) {
      const lower = col.toLowerCase()
      if (lower.includes('date') || lower.includes('fecha')) m['date'] = col
      else if (lower.includes('desc') || lower.includes('memo') || lower.includes('narr')) m['description'] = col
      else if (lower.includes('amount') || lower.includes('monto')) m['amount'] = col
      else if (lower.includes('debit') || lower.includes('withdrawal') || lower.includes('cargo')) m['debit'] = col
      else if (lower.includes('credit') || lower.includes('deposit') || lower.includes('abono')) m['credit'] = col
    }
    setMapping(m)
  }

  function loadSavedMapping(saved: any) {
    setBankName(saved.bankName)
    setMapping(saved.mapping as Record<string, string>)
  }

  async function handleImport() {
    if (!file || !activeBiz) return
    const hasAmount = mapping['amount'] || (mapping['debit'] && mapping['credit'])
    if (!mapping['date'] || !mapping['description'] || !hasAmount) {
      setError(t('import.mapRequired'))
      return
    }
    setLoading(true)
    setError('')
    const fd = new FormData()
    fd.append('businessId', activeBiz)
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    if (bankName) fd.append('bankName', bankName)
    const res = await fetch('/api/import', { method: 'POST', body: fd })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || t('import.importFailed')); return }
    setResult(data)
    setStep('result')
  }

  const fieldLabels: Record<string, string> = {
    date: t('import.fieldDate'),
    description: t('import.fieldDesc'),
    amount: t('import.fieldAmount'),
    debit: t('import.fieldDebit'),
    credit: t('import.fieldCredit'),
  }

  const stepKeys = ['upload', 'map', 'result']
  const stepLabels = [t('import.upload'), t('import.map'), t('import.result')]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('import.title')}</h1>

      {businesses.length > 1 && (
        <div>
          <label className="label">{t('business.switch')}</label>
          <select className="input w-auto" value={activeBiz} onChange={e => setActiveBiz(e.target.value)}>
            {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-4 text-sm">
        {stepKeys.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-[#1B4965] text-white' :
              i < stepKeys.indexOf(step) ? 'bg-emerald-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className={`font-medium ${step === s ? 'text-gray-800' : 'text-gray-400'}`}>{stepLabels[i]}</span>
            {i < 2 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">{t('import.uploadTitle')}</h2>
          <p className="text-sm text-gray-500">{t('import.formats')}</p>

          {savedMappings.length > 0 && (
            <div>
              <label className="label">{t('import.savedFormats')}</label>
              <div className="flex flex-wrap gap-2">
                {savedMappings.map((m: any) => (
                  <button key={m.id} onClick={() => loadSavedMapping(m)} className="btn-secondary text-xs py-1 px-3">
                    {m.bankName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#1B4965] transition-colors">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm text-gray-600 mb-3">{t('import.dragDrop')}</p>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" id="file-input" />
            <label htmlFor="file-input" className="btn-primary cursor-pointer text-sm">{t('import.chooseFile')}</label>
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">{t('import.map')}</h2>
            <span className="text-sm text-gray-500">{file?.name}</span>
          </div>

          <div>
            <label className="label">{t('import.bankName')}</label>
            <input className="input" placeholder="Chase, Bank of America..." value={bankName} onChange={e => setBankName(e.target.value)} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">{t('import.mapColumns')}</p>
            {FIELD_KEYS.map(field => (
              <div key={field} className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-600 w-28">
                  {fieldLabels[field]} {['date', 'description'].includes(field) ? '*' : ''}
                </label>
                <select
                  className="input flex-1 text-sm"
                  value={mapping[field] || ''}
                  onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="">{t('import.notMapped')}</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">{t('import.required_fields')}</p>

          <div className="flex gap-3">
            <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]) }} className="btn-secondary">{t('import.back')}</button>
            <button onClick={handleImport} disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? t('import.importing') : t('import.importBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <div className="card p-6 space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-3">{result.imported > 0 ? '✅' : '⚠️'}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">{t('import.complete')}</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-sm text-emerald-600">{t('import.imported')}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-amber-700">{result.duplicates}</p>
              <p className="text-sm text-amber-600">{t('import.duplicates')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-700">{result.total}</p>
              <p className="text-sm text-gray-500">{t('import.total')}</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 mb-1">{t('import.errors')} ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {result.errors.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setResult(null) }} className="btn-secondary">{t('import.importAnother')}</button>
            <button onClick={() => router.push('/transactions?status=PENDING')} className="btn-primary">{t('import.reviewTx')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
