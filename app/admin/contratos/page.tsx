'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ContractRow {
  id: string
  status: 'SENT' | 'CLIENT_SIGNED' | 'COMPLETED'
  signToken: string
  clientCompanyName: string | null
  clientEmail: string | null
  createdAt: string
  clientSignedAt: string | null
  providerSignedAt: string | null
  createdBy: { name: string | null; email: string }
  providerSignedBy: { name: string | null; email: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Enviado — falta firma del cliente',
  CLIENT_SIGNED: 'Falta contrafirmar',
  COMPLETED: 'Completado',
}

const STATUS_BADGE: Record<string, string> = {
  SENT: 'bg-amber-50 text-amber-700 border-amber-200',
  CLIENT_SIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function AdminContratosPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/contracts${filter ? `?status=${filter}` : ''}`)
    const data = await res.json()
    if (Array.isArray(data)) setContracts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contracts.length} contratos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/contratos/ajustes" className="btn-secondary">Ajustes</Link>
          <Link href="/admin/contratos/nuevo" className="btn-primary">+ Nuevo contrato</Link>
        </div>
      </div>

      <div className="card p-4 flex gap-2">
        {[
          { v: '', label: 'Todos' },
          { v: 'SENT', label: 'Falta firma cliente' },
          { v: 'CLIENT_SIGNED', label: 'Falta contrafirmar' },
          { v: 'COMPLETED', label: 'Completados' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setFilter(opt.v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              filter === opt.v ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : contracts.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">No hay contratos</div>
        ) : contracts.map(c => (
          <Link key={c.id} href={`/admin/contratos/${c.id}`} className="card p-4 flex items-center justify-between hover:shadow-card-hover transition-shadow block">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{c.clientCompanyName || c.clientEmail || 'Sin datos de cliente aún'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Creado por {c.createdBy.name || c.createdBy.email} · {new Date(c.createdAt).toLocaleDateString('es-CO')}
              </p>
            </div>
            <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
