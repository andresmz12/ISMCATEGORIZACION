'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ContractRow {
  id: string
  status: 'SENT' | 'CLIENT_SIGNED' | 'COMPLETED'
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
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    if (filter) qs.set('status', filter)
    if (search.trim()) qs.set('search', search.trim())
    qs.set('page', String(page))
    const res = await fetch(`/api/contracts?${qs.toString()}`)
    const data = await res.json()
    if (Array.isArray(data.contracts)) {
      setContracts(data.contracts)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter, page])
  useEffect(() => {
    setPage(1)
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function handleResend(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/contracts/${id}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (e: any) {
      alert(e.message || 'No se pudo reenviar')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contrato? Esta acción no se puede deshacer.')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} contratos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/contratos/ajustes" className="btn-secondary">Ajustes</Link>
          <Link href="/admin/contratos/nuevo" className="btn-primary">+ Nuevo contrato</Link>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <input
          className="input text-sm"
          placeholder="Buscar por empresa o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {[
            { v: '', label: 'Todos' },
            { v: 'SENT', label: 'Falta firma cliente' },
            { v: 'CLIENT_SIGNED', label: 'Falta contrafirmar' },
            { v: 'COMPLETED', label: 'Completados' },
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => { setFilter(opt.v); setPage(1) }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filter === opt.v ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : contracts.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">No hay contratos</div>
        ) : contracts.map(c => (
          <div key={c.id} className="card p-4 flex items-center justify-between">
            <Link href={`/admin/contratos/${c.id}`} className="flex-1 block">
              <p className="font-semibold text-gray-900 text-sm">
                {c.clientCompanyName || (c.clientEmail ? `Pendiente (${c.clientEmail})` : 'Sin datos de cliente aún')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Creado por {c.createdBy.name || c.createdBy.email} · {new Date(c.createdAt).toLocaleDateString('es-CO')}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              {c.status === 'SENT' && (
                <button
                  disabled={busyId === c.id}
                  onClick={() => handleResend(c.id)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                >
                  Reenviar
                </button>
              )}
              <button
                disabled={busyId === c.id}
                onClick={() => handleDelete(c.id)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  )
}
