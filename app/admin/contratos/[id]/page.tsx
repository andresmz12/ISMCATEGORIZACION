'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignatureCanvas } from '@/components/SignatureCanvas'

interface ContractDetail {
  id: string
  status: 'SENT' | 'CLIENT_SIGNED' | 'COMPLETED'
  signUrl: string
  clientCompanyName: string | null
  clientAddress: string | null
  clientState: string | null
  clientEmail: string | null
  clientFirstName: string | null
  clientLastName: string | null
  clientSignedAt: string | null
  providerFirstName: string | null
  providerLastName: string | null
  providerSignedAt: string | null
  monthlyFeeCents: number | null
  paymentDueDay: number | null
  pdfHash: string | null
  createdAt: string
  createdBy: { name: string | null; email: string }
}

interface ContractSettings {
  providerSignerFirstName: string | null
  providerSignerLastName: string | null
  providerSignatureDataUrl: string | null
}

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Falta firma del cliente',
  CLIENT_SIGNED: 'Falta contrafirmar',
  COMPLETED: 'Completado',
}

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [settings, setSettings] = useState<ContractSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [useSaved, setUseSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [contractRes, settingsRes] = await Promise.all([
      fetch(`/api/contracts/${params.id}`),
      fetch('/api/contracts/settings'),
    ])
    if (contractRes.ok) setContract(await contractRes.json())
    if (settingsRes.ok) setSettings(await settingsRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  const hasSavedSignature = !!(settings?.providerSignatureDataUrl && settings?.providerSignerFirstName && settings?.providerSignerLastName)

  useEffect(() => {
    if (hasSavedSignature && useSaved) {
      setFirstName(settings!.providerSignerFirstName!)
      setLastName(settings!.providerSignerLastName!)
      setSignature(settings!.providerSignatureDataUrl)
    }
  }, [hasSavedSignature, useSaved, settings])

  async function handleCountersign() {
    if (!firstName.trim() || !lastName.trim() || !signature) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/contracts/${params.id}/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, signatureBase64: signature }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo contrafirmar')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    try {
      const res = await fetch(`/api/contracts/${params.id}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      alert('Contrato reenviado')
    } catch (e: any) {
      alert(e.message || 'No se pudo reenviar')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este contrato? Esta acción no se puede deshacer.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/contracts/${params.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/admin/contratos')
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar')
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>
  if (!contract) return <div className="p-6 text-gray-400 text-sm">No encontrado</div>

  const signUrl = contract.signUrl

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contract.clientCompanyName || 'Contrato'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{STATUS_LABEL[contract.status]}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/contracts/${contract.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">Ver PDF</a>
          {contract.status === 'SENT' && (
            <button disabled={busy} onClick={handleResend} className="btn-secondary">Reenviar</button>
          )}
          <button disabled={busy} onClick={handleDelete} className="btn-danger">Eliminar</button>
        </div>
      </div>

      {contract.status === 'SENT' && (
        <div className="card p-4 bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-700">
            Enlace de firma del cliente: <input readOnly className="input inline-block w-auto text-xs ml-1" value={signUrl} onClick={e => (e.target as HTMLInputElement).select()} />
          </p>
        </div>
      )}

      <div className="card p-6 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-gray-400 text-xs mb-0.5">Cliente</p><p className="font-medium">{contract.clientCompanyName || '—'}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Email</p><p className="font-medium">{contract.clientEmail || '—'}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Dirección</p><p className="font-medium">{contract.clientAddress || '—'}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Estado</p><p className="font-medium">{contract.clientState || '—'}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Suscripción mensual</p><p className="font-medium">{contract.monthlyFeeCents != null ? `$${(contract.monthlyFeeCents / 100).toFixed(2)}` : '—'}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Día de pago</p><p className="font-medium">{contract.paymentDueDay != null ? `Día ${contract.paymentDueDay} de cada mes` : '—'}</p></div>
        </div>
      </div>

      {contract.status === 'CLIENT_SIGNED' && (
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Contrafirmar</h2>
          <p className="text-xs text-gray-500">
            Firmado por el cliente ({contract.clientFirstName} {contract.clientLastName}) el{' '}
            {contract.clientSignedAt ? new Date(contract.clientSignedAt).toLocaleString('es-CO') : '—'}.
            {' '}Este contrato quedó pendiente de contrafirma manual porque no había una firma del Proveedor guardada
            en Ajustes en el momento en que el cliente firmó.
          </p>

          {hasSavedSignature && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={useSaved} onChange={e => setUseSaved(e.target.checked)} />
              Usar la firma guardada de {settings!.providerSignerFirstName} {settings!.providerSignerLastName}
            </label>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={firstName} onChange={e => { setFirstName(e.target.value); setUseSaved(false) }} />
            </div>
            <div>
              <label className="label">Apellido</label>
              <input className="input" value={lastName} onChange={e => { setLastName(e.target.value); setUseSaved(false) }} />
            </div>
          </div>

          {useSaved && hasSavedSignature ? (
            <div>
              <p className="label">Firma</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings!.providerSignatureDataUrl!} alt="Firma guardada" className="h-24 border-2 border-dashed border-slate-300 rounded-lg bg-white" />
            </div>
          ) : (
            <SignatureCanvas onSignatureChange={setSignature} />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="btn-primary w-full"
            disabled={saving || !firstName.trim() || !lastName.trim() || !signature}
            onClick={handleCountersign}
          >
            {saving ? 'Firmando...' : 'Contrafirmar y completar contrato'}
          </button>
        </div>
      )}

      {contract.status === 'COMPLETED' && (
        <div className="card p-6 space-y-2">
          <h2 className="section-title">Integridad</h2>
          <p className="text-xs text-gray-500 font-mono break-all">SHA-256: {contract.pdfHash}</p>
        </div>
      )}
    </div>
  )
}
