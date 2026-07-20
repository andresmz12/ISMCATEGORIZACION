'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Business {
  id: string
  name: string
  industry: string | null
  entityType: string | null
  taxYear: number | null
  createdAt: string
  users: {
    role: string
    user: { id: string; name: string | null; email: string; accountType: string; plan: string }
  }[]
  _count: { transactions: number }
}

export default function AdminNegociosPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/businesses')
    const data = await res.json()
    if (Array.isArray(data)) setBusinesses(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = businesses.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) {
      const userMatch = b.users.some(bu =>
        bu.user.email.toLowerCase().includes(search.toLowerCase()) ||
        bu.user.name?.toLowerCase().includes(search.toLowerCase())
      )
      if (!userMatch) return false
    }
    return true
  })

  const planBadge: Record<string, string> = {
    ENTERPRISE: 'bg-purple-100 text-purple-700',
    PLUS: 'bg-blue-100 text-blue-700',
    BASIC: 'bg-gray-100 text-gray-600',
    NONE: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Negocios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{businesses.length} negocios registrados</p>
        </div>
      </div>

      <div className="card p-3 bg-blue-50 border-blue-100">
        <p className="text-xs text-blue-700">
          El presupuesto mensual de IA y el asistente de chat se administran por <strong>cuenta</strong> (no por negocio) —
          una cuenta puede tener varios negocios y comparten un solo límite. Edítalos en{' '}
          <Link href="/admin" className="underline font-medium">Administración → Cuentas</Link>.
        </p>
      </div>

      <div className="card p-4">
        <input
          className="input text-sm w-full max-w-sm"
          placeholder="Buscar por nombre o usuario..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">No se encontraron negocios</div>
        ) : filtered.map(biz => (
          <div key={biz.id} className="card overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === biz.id ? null : biz.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1B4965]/10 flex items-center justify-center text-sm font-bold text-[#1B4965]">
                  {biz.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{biz.name}</p>
                  <p className="text-xs text-gray-400">
                    {biz.industry || 'Sin industria'} · {biz.entityType || 'Sin entidad'} · {biz._count.transactions} transacciones
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{biz.users.length} usuario{biz.users.length !== 1 ? 's' : ''}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded === biz.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {expanded === biz.id && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-0.5">ID</p>
                    <p className="font-mono text-gray-600 text-xs break-all">{biz.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Año fiscal</p>
                    <p className="font-medium text-gray-700">{biz.taxYear || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Transacciones</p>
                    <p className="font-medium text-gray-700">{biz._count.transactions}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Creado</p>
                    <p className="font-medium text-gray-700">{new Date(biz.createdAt).toLocaleDateString('es-CO')}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Usuarios con acceso</p>
                  <div className="space-y-1.5">
                    {biz.users.map(bu => (
                      <div key={bu.user.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{bu.user.name || bu.user.email}</p>
                          <p className="text-xs text-gray-400">{bu.user.email} · {bu.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${planBadge[bu.user.plan] || 'bg-gray-100 text-gray-600'}`}>
                            {bu.user.plan}
                          </span>
                          <span className="text-xs text-gray-400">{bu.user.accountType}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/transactions?businessId=${biz.id}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1B4965]/10 text-[#1B4965] hover:bg-[#1B4965]/20 transition-colors"
                  >
                    Ver transacciones
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
