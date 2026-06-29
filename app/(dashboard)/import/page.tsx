'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useActiveBiz } from '@/lib/use-active-biz'

const FIELD_KEYS = ['date', 'description', 'amount', 'debit', 'credit'] as const

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

interface DupRow { row: number; date: string; description: string; amount: number; type: string; existingId: string }

function DuplicateTable({ rows, businessId, onImported }: { rows: DupRow[]; businessId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  async function forceImport(dup: DupRow) {
    setImporting(dup.existingId)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          date: dup.date,
          description: dup.description,
          amount: dup.amount,
          type: dup.type,
          status: 'PENDING',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onImported()
    } catch (err) {
      console.error('Force import failed:', err)
      alert('Error al importar. Por favor intenta de nuevo.')
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-left"
      >
        <span className="text-sm font-semibold text-amber-800">
          {rows.length} transacción{rows.length !== 1 ? 'es' : ''} marcada{rows.length !== 1 ? 's' : ''} como duplicada{rows.length !== 1 ? 's' : ''} — click para revisar
        </span>
        <svg className={`w-4 h-4 text-amber-600 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fila</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(dup => (
                <tr key={`${dup.row}-${dup.existingId}`} className="hover:bg-amber-50/50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">#{dup.row}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{new Date(dup.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{dup.description}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold text-xs ${dup.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {dup.type === 'CREDIT' ? '+' : '-'}{fmt(dup.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => forceImport(dup)}
                      disabled={importing === dup.existingId}
                      className="text-xs text-[#1B4965] font-medium hover:underline disabled:opacity-50"
                    >
                      {importing === dup.existingId ? 'Importando...' : 'Importar igualmente'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
            Estas transacciones ya existen con la misma fecha, descripción y monto. Si son realmente distintas, usa "Importar igualmente".
          </p>
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  const { t } = useTranslation()
  const { activeBizId: activeBiz } = useActiveBiz()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [headerRowNum, setHeaderRowNum] = useState(1)
  const [bankName, setBankName] = useState('')
  const [savedMappings, setSavedMappings] = useState<any[]>([])
  const [step, setStep] = useState<'upload' | 'map' | 'result'>('upload')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
      const lines = text.split('\n').filter(l => l.trim())
      const cols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1, 6).map(line =>
        line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      )
      setHeaders(cols)
      setPreviewRows(rows)
      autoDetectMapping(cols)
      setStep('map')
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const buffer = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]

      // Detect app's own export formats (not valid bank statements)
      const firstCellVal = String(ws.getRow(1).getCell(1).value ?? '')
      if (
        f.name.includes('transacciones-por-categoria') ||
        f.name.includes('reporte-corporativo') ||
        f.name.startsWith('report_') ||
        firstCellVal.toLowerCase().includes('transacciones por categoría') ||
        firstCellVal.toLowerCase().includes('reporte')
      ) {
        setError('Este archivo es un reporte generado por la aplicación. Para importar, sube el estado de cuenta original de tu banco (CSV o Excel directo del banco).')
        setFile(null)
        e.target.value = ''
        return
      }

      // Find actual header row: first row with 3+ non-empty cells
      let headerRowNum = 1
      const cols: string[] = []
      ws.eachRow((row, rowNum) => {
        if (cols.length >= 3) return
        // Count non-empty cells to find the header row
        let nonEmpty = 0
        row.eachCell({ includeEmpty: false }, () => { nonEmpty++ })
        if (nonEmpty >= 3) {
          headerRowNum = rowNum
          setHeaderRowNum(rowNum)
          // Use includeEmpty to preserve column positions (critical for alignment)
          row.eachCell({ includeEmpty: true }, (cell) => cols.push(String(cell.value ?? '').trim()))
        }
      })
      // Fallback to row 1 if nothing found
      if (cols.length === 0) {
        ws.getRow(1).eachCell((cell) => cols.push(String(cell.value ?? '')))
        headerRowNum = 1
      }

      const rows: string[][] = []
      ws.eachRow((row, rowNum) => {
        if (rowNum > headerRowNum && rowNum <= headerRowNum + 5) {
          const cells: string[] = []
          row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            if (colNum <= cols.length) {
              const v = cell.value
              // Format dates nicely
              if (v instanceof Date) cells.push(v.toLocaleDateString())
              else cells.push(String(v ?? ''))
            }
          })
          rows.push(cells)
        }
      })
      setHeaders(cols)
      setPreviewRows(rows)
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
    fd.append('headerRow', String(headerRowNum))
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

  // Columns highlighted by current mapping
  const mappedCols = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('import.title')}</h1>

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

      {/* Step 2: Map columns + Preview */}
      {step === 'map' && (
        <div className="space-y-4">
          {/* Data preview */}
          {previewRows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Vista previa — {file?.name}</h2>
                <span className="text-xs text-gray-400">{previewRows.length} filas (muestra)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${mappedCols.has(h) ? 'text-[#1B4965] bg-[#1B4965]/5' : 'text-gray-400'}`}>
                          {h}
                          {mappedCols.has(h) && (
                            <span className="ml-1 text-[10px] text-[#2EC4B6] font-normal">
                              ({Object.entries(mapping).find(([, v]) => v === h)?.[0]})
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {headers.map((h, j) => (
                          <td key={j} className={`px-3 py-2 whitespace-nowrap ${mappedCols.has(h) ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                            {row[j] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mapping form */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">{t('import.map')}</h2>
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
              <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([]); setHeaderRowNum(1) }} className="btn-secondary">{t('import.back')}</button>
              <button onClick={handleImport} disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? t('import.importing') : t('import.importBtn')}
              </button>
            </div>
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
          {result.duplicateRows?.length > 0 && (
            <DuplicateTable rows={result.duplicateRows} businessId={activeBiz} onImported={() => { setResult((r: any) => ({ ...r, duplicateRows: [] })) }} />
          )}
          {result.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 mb-1">{t('import.errors')} ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {result.errors.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([]); setResult(null) }} className="btn-secondary">{t('import.importAnother')}</button>
            <button onClick={() => router.push('/transactions?status=PENDING')} className="btn-primary">{t('import.reviewTx')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
