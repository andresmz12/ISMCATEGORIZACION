'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StoreInput { name: string; address: string }

export default function NewContractPage() {
  const router = useRouter()
  const [clientCompanyName, setClientCompanyName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientState, setClientState] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [servicesScope, setServicesScope] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [startDate, setStartDate] = useState('')
  const [additionalTerms, setAdditionalTerms] = useState('')
  const [stores, setStores] = useState<StoreInput[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ signUrl: string } | null>(null)

  function addStore() {
    setStores([...stores, { name: '', address: '' }])
  }
  function updateStore(i: number, field: keyof StoreInput, value: string) {
    setStores(stores.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }
  function removeStore(i: number) {
    setStores(stores.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/contracts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCompanyName,
          clientAddress,
          clientState,
          clientEmail,
          servicesScope,
          monthlyFeeCents: monthlyFee ? Math.round(parseFloat(monthlyFee) * 100) : null,
          startDate: startDate || null,
          additionalTerms,
          stores: stores.filter(s => s.name.trim()),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el contrato')
      setResult({ signUrl: data.signUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-gray-900">Contrato creado</p>
          {clientEmail ? (
            <p className="text-sm text-gray-500">Se envió un correo a {clientEmail} con el enlace de firma.</p>
          ) : (
            <p className="text-sm text-gray-500">No se envió correo (sin email de cliente). Comparte este enlace manualmente:</p>
          )}
          <input readOnly className="input text-xs" value={result.signUrl} onClick={e => (e.target as HTMLInputElement).select()} />
          <button className="btn-primary" onClick={() => router.push('/admin/contratos')}>Ver contratos</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato</h1>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Datos del cliente (opcional — se le pedirá lo que falte al firmar)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Empresa</label>
            <input className="input" value={clientCompanyName} onChange={e => setClientCompanyName(e.target.value)} />
          </div>
          <div>
            <label className="label">Estado</label>
            <input className="input" value={clientState} onChange={e => setClientState(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Email (si lo tienes, se le enviará el enlace automáticamente)</label>
            <input type="email" className="input" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Términos</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tarifa mensual (USD)</label>
            <input type="number" step="0.01" className="input" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha de inicio</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Alcance de los servicios</label>
          <textarea className="input" rows={4} value={servicesScope} onChange={e => setServicesScope(e.target.value)} />
        </div>
        <div>
          <label className="label">Términos adicionales</label>
          <textarea className="input" rows={3} value={additionalTerms} onChange={e => setAdditionalTerms(e.target.value)} />
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Ubicaciones cubiertas (opcional)</h2>
          <button type="button" className="text-xs font-medium text-[#1B4965] hover:underline" onClick={addStore}>+ Agregar</button>
        </div>
        {stores.map((s, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input className="input flex-1" placeholder="Nombre (ej. Tienda Centro)" value={s.name} onChange={e => updateStore(i, 'name', e.target.value)} />
            <input className="input flex-1" placeholder="Dirección" value={s.address} onChange={e => updateStore(i, 'address', e.target.value)} />
            <button type="button" onClick={() => removeStore(i)} className="btn-secondary px-3">✕</button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary w-full" disabled={saving} onClick={handleSubmit}>
        {saving ? 'Creando...' : 'Crear y enviar contrato'}
      </button>
    </div>
  )
}
