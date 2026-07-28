'use client'
import { useEffect, useState } from 'react'
import { SignatureCanvas } from '@/components/SignatureCanvas'

interface Settings {
  providerCompanyName: string | null
  providerAddress: string | null
  providerCity: string | null
  providerState: string | null
  providerZip: string | null
  providerEmail: string | null
  providerPhone: string | null
  providerTaxId: string | null
  providerSignerFirstName: string | null
  providerSignerLastName: string | null
  providerSignatureDataUrl: string | null
  notifyEmail: string | null
}

const EMPTY: Settings = {
  providerCompanyName: '',
  providerAddress: '',
  providerCity: '',
  providerState: '',
  providerZip: '',
  providerEmail: '',
  providerPhone: '',
  providerTaxId: '',
  providerSignerFirstName: '',
  providerSignerLastName: '',
  providerSignatureDataUrl: null,
  notifyEmail: '',
}

export default function ContractSettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [redrawSignature, setRedrawSignature] = useState(false)
  const [newSignature, setNewSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contracts/settings')
      .then(res => res.json())
      .then(data => setSettings({ ...EMPTY, ...data }))
      .finally(() => setLoading(false))
  }, [])

  function set(field: keyof Settings, value: string) {
    setSettings(s => ({ ...s, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/contracts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          // Only send a signature value when the admin actually redrew one —
          // omitting the field entirely leaves the saved signature untouched.
          ...(redrawSignature && newSignature ? { providerSignatureDataUrl: newSignature } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setSettings({ ...EMPTY, ...data })
      setRedrawSignature(false)
      setNewSignature(null)
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  const fields: { key: keyof Settings; label: string; required?: boolean }[] = [
    { key: 'providerCompanyName', label: 'Nombre de la empresa (Proveedor)', required: true },
    { key: 'providerAddress', label: 'Dirección', required: true },
    { key: 'providerCity', label: 'Ciudad' },
    { key: 'providerState', label: 'Estado' },
    { key: 'providerZip', label: 'Código postal' },
    { key: 'providerEmail', label: 'Email' },
    { key: 'providerPhone', label: 'Teléfono' },
    { key: 'providerTaxId', label: 'Tax ID (EIN)' },
    { key: 'notifyEmail', label: 'Email interno a notificar cuando falta contrafirma manual' },
  ]

  const missingAddress = !settings.providerCompanyName?.trim() || !settings.providerAddress?.trim()
  const hasSavedSignature = !!settings.providerSignatureDataUrl
  const missingSignature = !hasSavedSignature || !settings.providerSignerFirstName?.trim() || !settings.providerSignerLastName?.trim()

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes de contratos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Datos fijos del Proveedor que aparecen en cada contrato generado.</p>
      </div>

      {missingAddress && (
        <div className="card p-4 bg-red-50 border-red-100">
          <p className="text-xs text-red-700">Falta la empresa y/o dirección del Proveedor — no se pueden crear contratos hasta completarlos.</p>
        </div>
      )}
      {!missingAddress && missingSignature && (
        <div className="card p-4 bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700">
            Falta el nombre y/o la firma guardada del Proveedor. Sin eso, los contratos que firme el cliente van a
            quedar pendientes de contrafirma manual en vez de completarse automáticamente.
          </p>
        </div>
      )}

      <div className="card p-6 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}{f.required && ' *'}</label>
            <input className="input" value={settings[f.key] as string || ''} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Firma del Proveedor (se dibuja una vez y se reusa en cada contrato)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre de quien firma</label>
            <input className="input" value={settings.providerSignerFirstName || ''} onChange={e => set('providerSignerFirstName', e.target.value)} />
          </div>
          <div>
            <label className="label">Apellido de quien firma</label>
            <input className="input" value={settings.providerSignerLastName || ''} onChange={e => set('providerSignerLastName', e.target.value)} />
          </div>
        </div>

        {hasSavedSignature && !redrawSignature ? (
          <div>
            <p className="label">Firma guardada</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.providerSignatureDataUrl!} alt="Firma guardada" className="h-24 border-2 border-dashed border-slate-300 rounded-lg bg-white" />
            <button type="button" onClick={() => setRedrawSignature(true)} className="text-xs font-medium text-[#1B4965] hover:underline mt-1.5">
              Cambiar firma
            </button>
          </div>
        ) : (
          <div>
            <SignatureCanvas onSignatureChange={setNewSignature} />
            {hasSavedSignature && (
              <button type="button" onClick={() => { setRedrawSignature(false); setNewSignature(null) }} className="text-xs font-medium text-[#1B4965] hover:underline mt-1.5">
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Guardado</p>}

      <button className="btn-primary w-full" disabled={saving} onClick={handleSave}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
