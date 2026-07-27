'use client'
import { useEffect, useState } from 'react'

interface Settings {
  providerCompanyName: string | null
  providerAddress: string | null
  providerCity: string | null
  providerState: string | null
  providerZip: string | null
  providerEmail: string | null
  providerPhone: string | null
  providerTaxId: string | null
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
  notifyEmail: '',
}

export default function ContractSettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
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
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
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
    { key: 'notifyEmail', label: 'Email interno a notificar cuando un cliente firma' },
  ]

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes de contratos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Datos fijos del Proveedor que aparecen en cada contrato generado. Requeridos antes de poder crear contratos.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}{f.required && ' *'}</label>
            <input className="input" value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Guardado</p>}

      <button className="btn-primary w-full" disabled={saving} onClick={handleSave}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
