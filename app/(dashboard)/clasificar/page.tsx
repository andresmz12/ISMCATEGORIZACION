'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const FIELD_KEYS = ['date', 'description', 'amount', 'debit', 'credit'] as const
const FIELD_LABELS: Record<string, string> = {
  date: 'Fecha *', description: 'Descripción *', amount: 'Monto', debit: 'Débito', credit: 'Crédito',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-red-100 text-red-700',
}

export default function ClasificarPage() {
  const router = useRouter()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const { businesses, activeBizId: activeBiz } = useActiveBiz()
  const [savedMappings, setSavedMappings] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [bankName, setBankName] = useState('')
  const [headerRowNum, setHeaderRowNum] = useState(1)

  const [step, setStep] = useState<'upload' | 'map' | 'processing' | 'review' | 'done'>('upload')
  const [processingMsg, setProcessingMsg] = useState('')
  const [processingPct, setProcessingPct] = useState(0)

  const [transactions, setTransactions] = useState<any[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!activeBiz) return
    fetch(`/api/import?businessId=${activeBiz}`).then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) setSavedMappings(d)
    })
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) setCategories(d)
    })
  }, [activeBiz])

  async function processFile(f: File) {
    setFile(f)
    setError('')
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const text = await f.text()
      const lines = text.split('\n').filter(l => l.trim())
      const cols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1, 6).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setHeaderRowNum(1)
      setHeaders(cols); setPreviewRows(rows); autoDetect(cols); setStep('map')
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const buffer = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]

      // Auto-detect header row: first row with 3+ non-empty cells
      let detectedHeaderRow = 1
      let found = false
      ws.eachRow((row, rowNum) => {
        if (!found) {
          const vals = row.values as any[]
          const nonEmpty = vals.slice(1).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length
          if (nonEmpty >= 3) { detectedHeaderRow = rowNum; found = true }
        }
      })

      const cols: string[] = []
      ws.getRow(detectedHeaderRow).eachCell(cell => cols.push(String(cell.value ?? '')))
      const rows: string[][] = []
      ws.eachRow((row, rowNum) => {
        if (rowNum > detectedHeaderRow && rowNum <= detectedHeaderRow + 5) {
          const cells: string[] = []
          row.eachCell({ includeEmpty: true }, (cell, colNum) => { if (colNum <= cols.length) cells.push(String(cell.value ?? '')) })
          rows.push(cells)
        }
      })
      setHeaderRowNum(detectedHeaderRow)
      setHeaders(cols); setPreviewRows(rows); autoDetect(cols); setStep('map')
    } else {
      setError('Solo se aceptan archivos CSV, XLSX o XLS.')
    }
  }

  function autoDetect(cols: string[]) {
    const m: Record<string, string> = {}
    for (const col of cols) {
      const l = col.toLowerCase()
      if (l.includes('date') || l.includes('fecha')) m['date'] = col
      else if (l.includes('desc') || l.includes('memo') || l.includes('narr')) m['description'] = col
      else if (l.includes('amount') || l.includes('monto')) m['amount'] = col
      else if (l.includes('debit') || l.includes('withdrawal') || l.includes('cargo')) m['debit'] = col
      else if (l.includes('credit') || l.includes('deposit') || l.includes('abono')) m['credit'] = col
    }
    setMapping(m)
  }

  function loadSavedMapping(saved: any) {
    setBankName(saved.bankName)
    setMapping(saved.mapping as Record<string, string>)
  }

  async function runImportAndClassify() {
    if (!file || !activeBiz) return
    const hasAmount = mapping['amount'] || (mapping['debit'] && mapping['credit'])
    if (!mapping['date'] || !mapping['description'] || !hasAmount) {
      setError('Debes mapear al menos: Fecha, Descripción y Monto (o Débito/Crédito).')
      return
    }
    setError('')
    setStep('processing')
    setProcessingPct(10)
    setProcessingMsg('Subiendo archivo...')

    const fd = new FormData()
    fd.append('businessId', activeBiz)
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    fd.append('headerRow', String(headerRowNum))
    if (bankName) fd.append('bankName', bankName)

    const importRes = await fetch('/api/import', { method: 'POST', body: fd })
    const importData = await importRes.json()
    if (!importRes.ok) { setError(importData.error || 'Error al importar'); setStep('map'); return }

    setImportResult({ imported: importData.imported, duplicates: importData.duplicates, total: importData.total })
    setProcessingPct(40)

    const importedIds: string[] = importData.importedIds || []

    if (!importedIds.length) {
      // All duplicates - load existing pending transactions
      setProcessingMsg('Cargando transacciones existentes...')
      setProcessingPct(80)
      const txRes = await fetch(`/api/transactions?businessId=${activeBiz}&status=PENDING&limit=200`)
      const txData = await txRes.json()
      const txList = txData.transactions || []
      if (!txList.length) {
        setError('No hay transacciones nuevas ni pendientes. Todas eran duplicadas.')
        setStep('map')
        return
      }
      setTransactions(txList)
      setProcessingPct(100)
      setStep('review')
      return
    }

    setProcessingMsg(`Clasificando ${importedIds.length} transacciones con IA...`)
    setProcessingPct(55)

    const classifyRes = await fetch('/api/classify-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBiz, transactionIds: importedIds }),
    })
    const classifyData = await classifyRes.json()
    if (!classifyRes.ok) {
      setError(classifyData.error || 'Error al clasificar con IA')
      setStep('map')
      return
    }

    setProcessingPct(85)
    setProcessingMsg('Cargando resultados...')

    // Fetch the classified transactions with their category info
    const txRes = await fetch(`/api/transactions?businessId=${activeBiz}&limit=500`)
    const txData = await txRes.json()
    const allTx = txData.transactions || []
    const importedSet = new Set(importedIds)
    const classified = allTx.filter((t: any) => importedSet.has(t.id))

    setTransactions(classified)
    setProcessingPct(100)
    setStep('review')
  }

  async function updateTxCategory(txId: string, categoryId: string) {
    const cat = categories.find(c => c.id === categoryId)
    const oldTx = transactions.find(tx => tx.id === txId)

    // Optimistic update
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, categoryId, category: cat || tx.category, status: 'CLASSIFIED', method: 'MANUAL' } : tx))

    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: categoryId || null, status: 'CLASSIFIED', method: 'MANUAL' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('Update failed, rolling back:', err)
      // Rollback on failure
      if (oldTx) setTransactions(prev => prev.map(tx => tx.id === txId ? oldTx : tx))
      toast('Error al actualizar categoría', 'error')
    }
  }

  async function confirmAll() {
    setConfirming(true)
    try {
      const needsReview = transactions.filter(tx => tx.status === 'NEEDS_REVIEW')
      if (needsReview.length === 0) {
        toast('No hay transacciones por confirmar', 'info')
        setConfirming(false)
        return
      }
      const results = await Promise.all(needsReview.map(tx =>
        fetch(`/api/transactions/${tx.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CLASSIFIED' }),
        })
      ))
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        toast(`${failed} errores al confirmar`, 'error')
      } else {
        setTransactions(prev => prev.map(tx => ({ ...tx, status: 'CLASSIFIED' })))
        setStep('done')
        toast('Todas las transacciones confirmadas', 'success')
      }
    } catch (err) {
      console.error('Confirm all failed:', err)
      toast('Error al confirmar transacciones', 'error')
    } finally {
      setConfirming(false)
    }
  }

  async function downloadExcel() {
    try {
      const biz = businesses.find(b => b.id === activeBiz)
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.created = new Date()

      const ws = wb.addWorksheet('Transacciones')
      ws.columns = [
        { header: 'Fecha', key: 'date', width: 14 },
        { header: 'Descripción', key: 'description', width: 40 },
        { header: 'Monto', key: 'amount', width: 14 },
        { header: 'Tipo', key: 'type', width: 10 },
        { header: 'Categoría', key: 'category', width: 28 },
        { header: 'Deducible', key: 'deductibility', width: 12 },
        { header: 'Confianza IA', key: 'confidence', width: 14 },
      ]
      const headerRow = ws.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4965' } }
      headerRow.height = 20

      for (const tx of transactions) {
        const row = ws.addRow({
          date: tx.date ? new Date(tx.date).toLocaleDateString('en-US') : '',
          description: tx.description,
          amount: typeof tx.amount === 'number' ? tx.amount : 0,
          type: tx.type === 'CREDIT' ? 'Ingreso' : 'Gasto',
          category: tx.category?.name || tx.aiSuggestion || 'Sin categoría',
          deductibility: tx.deductibility === 'YES' ? '100%' : tx.deductibility === 'FIFTY' ? '50%' : 'No',
          confidence: tx.aiConfidence || '',
        })
        const amtCell = row.getCell('amount')
        amtCell.numFmt = '"$"#,##0.00'
        amtCell.font = { color: { argb: tx.type === 'CREDIT' ? 'FF059669' : 'FFDC2626' } }
      }
      ws.autoFilter = { from: 'A1', to: 'G1' }

      const wsSummary = wb.addWorksheet('Resumen')
      wsSummary.addRow([`Reporte — ${biz?.name || 'Negocio'}`])
      wsSummary.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1B4965' } }
      wsSummary.addRow([new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })])
      wsSummary.addRow([])
      wsSummary.addRow(['Concepto', 'Valor'])
      wsSummary.getRow(4).font = { bold: true }
      const income = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
      const expenses = transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      for (const [label, val] of [['Total Ingresos', income], ['Total Gastos', expenses], ['Ganancia Neta', income - expenses], ['Total Deducible', totalDeductible]]) {
        const r = wsSummary.addRow([label, val])
        if (typeof val === 'number') r.getCell(2).numFmt = '"$"#,##0.00'
      }
      wsSummary.getColumn(1).width = 26
      wsSummary.getColumn(2).width = 18

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${Date.now()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast('Descarga completada', 'success')
    } catch (err) {
      console.error('Download Excel failed:', err)
      toast('Error al descargar reporte', 'error')
    }
  }

  async function downloadPDF() {
    const biz = businesses.find(b => b.id === activeBiz)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const now = new Date()

    // Header
    doc.setFillColor(27, 73, 101)
    doc.rect(0, 0, 297, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${biz?.name || ''} — Reporte de Clasificación`, 14, 9)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(now.toLocaleDateString(), 14, 17)

    // Summary row
    const income = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

    doc.setTextColor(40, 40, 40)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    const summaryY = 30
    doc.text(`Ingresos: ${fmt(income)}`, 14, summaryY)
    doc.text(`Gastos: ${fmt(expenses)}`, 80, summaryY)
    doc.text(`Ganancia Neta: ${fmt(income - expenses)}`, 146, summaryY)

    // Transactions table
    autoTable(doc, {
      startY: 36,
      head: [['Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría', 'Confianza']],
      body: transactions.map(tx => [
        tx.date ? new Date(tx.date).toLocaleDateString('en-US') : '',
        tx.description?.substring(0, 55) || '',
        fmt(tx.amount),
        tx.type === 'CREDIT' ? 'Ingreso' : 'Gasto',
        tx.category?.name || tx.aiSuggestion || '—',
        tx.aiConfidence || '—',
      ]),
      headStyles: { fillColor: [27, 73, 101], fontSize: 7, halign: 'center' },
      bodyStyles: { fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 90 },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 66 },
        5: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const tx = transactions[data.row.index]
          if (tx?.type === 'CREDIT') data.cell.styles.textColor = [5, 150, 105]
          else data.cell.styles.textColor = [220, 38, 38]
        }
        if (data.section === 'body') {
          const tx = transactions[data.row.index]
          if (tx?.aiConfidence === 'LOW' || tx?.status === 'NEEDS_REVIEW') {
            data.cell.styles.fillColor = [254, 249, 195]
          }
        }
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    })

    doc.save(`reporte-${now.toISOString().split('T')[0]}.pdf`)
  }

  // Stats for review step
  const totalTx = transactions.length
  const autoClassified = transactions.filter(tx => tx.aiConfidence === 'HIGH').length
  const needsReview = transactions.filter(tx => tx.status === 'NEEDS_REVIEW' || tx.aiConfidence === 'LOW' || tx.aiConfidence === 'MEDIUM').length
  const totalExpenses = transactions.filter(tx => tx.type === 'DEBIT').reduce((s, tx) => s + tx.amount, 0)

  const mappedCols = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clasificar con IA</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sube tu estado de cuenta y la IA lo clasifica automáticamente</p>
        </div>
      </div>

      {/* Step progress */}
      {step !== 'done' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['upload', 'map', 'processing', 'review'] as const).map((s, i) => {
            const labels = ['Subir', 'Mapear', 'Clasificando', 'Revisar']
            const idx = ['upload', 'map', 'processing', 'review'].indexOf(step)
            const done = i < idx
            const active = s === step
            return (
              <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${active ? 'bg-[#1B4965] text-white' : done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-gray-800' : done ? 'text-emerald-600' : 'text-gray-400'}`}>{labels[i]}</span>
                {i < 3 && <span className="text-gray-300 text-xs">›</span>}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <div className="card p-6 space-y-5">
          {savedMappings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">FORMATOS GUARDADOS</p>
              <div className="flex flex-wrap gap-2">
                {savedMappings.map((m: any) => (
                  <button key={m.id} onClick={() => loadSavedMapping(m)} className="text-xs px-3 py-1.5 rounded-lg bg-[#1B4965]/10 text-[#1B4965] font-medium hover:bg-[#1B4965]/20 transition-colors">
                    {m.bankName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragging ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-gray-200'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={async e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) await processFile(f) }}
          >
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1B4965]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Sube tu estado de cuenta</p>
            <p className="text-sm text-gray-400 mb-3 hidden sm:block">Arrastra el archivo aquí o usa el botón</p>
            <div className="flex justify-center gap-2 mb-5">
              {['CSV', 'XLSX', 'XLS'].map(ext => (
                <span key={ext} className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded font-mono">.{ext.toLowerCase()}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#1B4965] text-white rounded-xl text-sm font-semibold hover:bg-[#153d52] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Seleccionar archivo
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={async e => { const f = e.target.files?.[0]; if (f) await processFile(f) }} />
        </div>
      )}

      {/* ── STEP 2: MAP ── */}
      {step === 'map' && (
        <div className="space-y-4">
          {previewRows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Vista previa — {file?.name}</h2>
                <span className="text-xs text-gray-400">{previewRows.length} filas de muestra</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${mappedCols.has(h) ? 'text-[#1B4965] bg-[#1B4965]/5' : 'text-gray-400'}`}>
                          {h}
                          {mappedCols.has(h) && (
                            <span className="ml-1 text-[10px] text-emerald-600">
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
                          <td key={j} className={`px-3 py-2 whitespace-nowrap ${mappedCols.has(h) ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{row[j] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Mapeo de columnas</h2>
            <div>
              <label className="label">Nombre del banco (opcional)</label>
              <input className="input" placeholder="Chase, Bank of America, Wells Fargo..." value={bankName} onChange={e => setBankName(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Si lo guardas, lo usaremos automáticamente la próxima vez.</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">¿Cuál columna corresponde a cada campo?</p>
              {FIELD_KEYS.map(field => (
                <div key={field} className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-600 w-28">{FIELD_LABELS[field]}</label>
                  <select
                    className="input flex-1 text-sm"
                    value={mapping[field] || ''}
                    onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">— No usar —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([]) }} className="btn-secondary">← Volver</button>
              <button onClick={runImportAndClassify} className="btn-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Importar y Clasificar con IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: PROCESSING ── */}
      {step === 'processing' && (
        <div className="card p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[#1B4965]/10 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-4 border-[#1B4965]/20 border-t-[#1B4965] animate-spin" />
              <svg className="w-8 h-8 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800 mb-1">{processingMsg}</p>
            <p className="text-sm text-gray-400">Esto puede tomar unos segundos...</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B4965] rounded-full transition-all duration-500"
                style={{ width: `${processingPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{processingPct}%</p>
          </div>
        </div>
      )}

      {/* ── STEP 4: REVIEW ── */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Import info banner */}
          {importResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-sm text-emerald-800">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{importResult.imported}</strong> transacciones importadas
                {importResult.duplicates > 0 && ` · ${importResult.duplicates} duplicadas omitidas`}
                {' · '}<strong>{totalTx}</strong> en esta revisión
              </span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: totalTx, type: 'count', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-100' },
              { label: 'Auto-clasificadas', value: autoClassified, type: 'count', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { label: 'Para revisar', value: needsReview, type: 'count', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
              { label: 'Total Gastos', value: totalExpenses, type: 'money', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border p-3 ${card.bg} ${card.border}`}>
                <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>
                  {card.type === 'money' ? fmt(card.value as number) : card.value}
                </p>
              </div>
            ))}
          </div>

          {needsReview > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.072 16.5C2.302 18.333 3.264 20 4.804 20z" />
              </svg>
              <span>Las filas en <strong>amarillo</strong> tienen confianza MEDIUM o LOW — revisa y ajusta la categoría si es necesario.</span>
            </div>
          )}

          {/* Transactions table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">Fecha</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Monto</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-44">Categoría</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Confianza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx: any) => {
                    const isLow = tx.aiConfidence === 'LOW' || tx.aiConfidence === 'MEDIUM' || tx.status === 'NEEDS_REVIEW'
                    return (
                      <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${isLow ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 max-w-[260px]">
                          <p className="truncate text-gray-800 text-sm">{tx.description}</p>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-semibold text-sm whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.type === 'CREDIT' ? '+' : '−'}{fmt(tx.amount)}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            className={`text-xs border rounded px-2 py-1 bg-white w-full ${isLow ? 'border-amber-300' : 'border-gray-200'}`}
                            value={tx.categoryId || ''}
                            onChange={e => updateTxCategory(tx.id, e.target.value)}
                          >
                            <option value="">Sin categoría</option>
                            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {tx.aiConfidence && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLOR[tx.aiConfidence] || 'bg-gray-100 text-gray-500'}`}>
                              {tx.aiConfidence}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={confirmAll}
              disabled={confirming}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {confirming ? 'Confirmando...' : `Confirmar clasificación (${totalTx})`}
            </button>
            <div className="flex gap-3">
              <button onClick={downloadExcel} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Excel
              </button>
              <button onClick={downloadPDF} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
              <button
                onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([]); setTransactions([]) }}
                className="flex-1 btn-secondary text-sm"
              >
                Otro archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: DONE ── */}
      {step === 'done' && (
        <div className="card p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">¡Clasificación completa!</h2>
            <p className="text-gray-500">
              {totalTx} transacciones clasificadas · {fmt(totalExpenses)} en gastos totales
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={downloadPDF} className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Descargar PDF
            </button>
            <button onClick={downloadExcel} className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar Excel
            </button>
            <button onClick={() => router.push('/transactions')} className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Ver en Transacciones
            </button>
            <button
              onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([]); setTransactions([]); setImportResult(null) }}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Clasificar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
