'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const COLUMN_OPTIONS = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'reference', '— ignore —']

export default function ImportPage() {
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
      setBusinesses(data)
      const saved = localStorage.getItem('activeBusiness')
      const biz = (saved && data.find((b: any) => b.id === saved)) || data[0]
      if (biz) {
        setActiveBiz(biz.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/import?businessId=${activeBiz}`).then(r => r.json()).then(setSavedMappings)
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
      const XLSX = await import('xlsx')
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const cols = (rows[0] || []).map(String)
      setHeaders(cols)
      autoDetectMapping(cols)
      setStep('map')
    } else {
      setError('Only CSV and XLSX files supported')
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
    const requiredFields = ['date', 'description']
    const hasAmount = mapping['amount'] || (mapping['debit'] && mapping['credit'])
    if (!requiredFields.every(f => mapping[f]) || !hasAmount) {
      setError('Please map: date, description, and amount (or debit+credit)')
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
    if (!res.ok) { setError(data.error || 'Import failed'); return }
    setResult(data)
    setStep('result')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Import Transactions</h1>

      {/* Business selector */}
      {businesses.length > 1 && (
        <div>
          <label className="label">Business</label>
          <select className="input w-auto" value={activeBiz} onChange={e => setActiveBiz(e.target.value)}>
            {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-4 text-sm">
        {['upload', 'map', 'result'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-yellow-400 text-yellow-900' : i < ['upload', 'map', 'result'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className={`capitalize font-medium ${step === s ? 'text-gray-800' : 'text-gray-400'}`}>{s}</span>
            {i < 2 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Upload Bank Statement</h2>
          <p className="text-sm text-gray-500">Supported formats: CSV, XLSX</p>

          {savedMappings.length > 0 && (
            <div>
              <label className="label">Saved Bank Formats</label>
              <div className="flex flex-wrap gap-2">
                {savedMappings.map((m: any) => (
                  <button key={m.id} onClick={() => loadSavedMapping(m)} className="btn-secondary text-xs py-1 px-3">
                    {m.bankName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-yellow-400 transition-colors">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm text-gray-600 mb-3">Drop your bank statement here or click to browse</p>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" id="file-input" />
            <label htmlFor="file-input" className="btn-primary cursor-pointer text-sm">Choose File</label>
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Map Columns</h2>
            <span className="text-sm text-gray-500">{file?.name}</span>
          </div>

          <div>
            <label className="label">Bank Name (for saving this mapping)</label>
            <input className="input" placeholder="e.g. Chase, Bank of America" value={bankName} onChange={e => setBankName(e.target.value)} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Map your columns to fields:</p>
            {['date', 'description', 'amount', 'debit', 'credit'].map(field => (
              <div key={field} className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-600 w-28 capitalize">{field} {['date', 'description'].includes(field) ? '*' : ''}</label>
                <select
                  className="input flex-1 text-sm"
                  value={mapping[field] || ''}
                  onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="">— not mapped —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">* Required. Map either "amount" OR both "debit" and "credit".</p>

          <div className="flex gap-3">
            <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]) }} className="btn-secondary">Back</button>
            <button onClick={handleImport} disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Importing...' : 'Import Transactions'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <div className="card p-6 space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-3">{result.imported > 0 ? '✅' : '⚠️'}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Import Complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-sm text-green-600">Imported</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-yellow-700">{result.duplicates}</p>
              <p className="text-sm text-yellow-600">Duplicates skipped</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-700">{result.total}</p>
              <p className="text-sm text-gray-500">Total rows</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 mb-1">Errors ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {result.errors.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setResult(null) }} className="btn-secondary">Import Another</button>
            <button onClick={() => router.push('/transactions?status=PENDING')} className="btn-primary">Review Transactions</button>
          </div>
        </div>
      )}
    </div>
  )
}
