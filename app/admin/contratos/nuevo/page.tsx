'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewContractPage() {
  const router = useRouter()
  const [clientEmail, setClientEmail] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [paymentDueDay, setPaymentDueDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ signUrl: string } | null>(null)

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/contracts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          monthlyFeeCents: monthlyFee ? Math.round(parseFloat(monthlyFee) * 100) : null,
          paymentDueDay: paymentDueDay ? parseInt(paymentDueDay, 10) : null,
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
          <p className="text-sm text-gray-500">Se envió un correo a {clientEmail} con el enlace de firma y el PDF adjunto. El cliente completa sus propios datos (empresa, dirección, estado) al abrirlo.</p>
          <input readOnly className="input text-xs" value={result.signUrl} onClick={e => (e.target as HTMLInputElement).select()} />
          <button className="btn-primary" onClick={() => router.push('/admin/contratos')}>Ver contratos</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Contrato de Servicio de Software "MyProfitandLoss". El texto legal es fijo. Solo necesitas el email del
          cliente y los términos de precio — el cliente completa su propia empresa, dirección y estado al abrir el
          enlace de firma.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Cliente</h2>
        <div>
          <label className="label">Email *</label>
          <input type="email" required className="input" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@empresa.com" />
          <p className="text-xs text-gray-400 mt-1">A este correo se le envía el enlace de firma y el PDF del contrato.</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Precio y forma de pago</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Suscripción mensual (USD)</label>
            <input type="number" step="0.01" className="input" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
          </div>
          <div>
            <label className="label">Día de pago de cada mes (1-28)</label>
            <input type="number" min={1} max={28} className="input" value={paymentDueDay} onChange={e => setPaymentDueDay(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary w-full" disabled={saving || !clientEmail.trim()} onClick={handleSubmit}>
        {saving ? 'Creando...' : 'Crear y enviar contrato'}
      </button>
    </div>
  )
}
