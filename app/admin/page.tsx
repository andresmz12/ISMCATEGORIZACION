'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface User {
  id: string
  name?: string
  email: string
  accountType: string
  plan: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  _count?: { businessUsers: number }
}

interface Metrics {
  totalAccounts: number
  totalAccountants: number
  totalIndividuals: number
  totalBusinesses: number
  totalTx: number
  aiUsage: number
}

export default function AdminPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [u, m] = await Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/metrics').then(r => r.json()),
    ])
    if (Array.isArray(u)) setUsers(u)
    if (m && !m.error) setMetrics(m)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteUser(user: User) {
    if (!confirm(`¿Eliminar a ${user.name || user.email}? Esta acción no se puede deshacer.`)) return
    setActionLoading(user.id)
    await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    await load()
    setActionLoading(null)
  }

  async function toggleStatus(user: User) {
    setActionLoading(user.id)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    await load()
    setActionLoading(null)
  }

  async function changePlan(user: User, plan: string) {
    setActionLoading(user.id)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    await load()
    setActionLoading(null)
  }

  const filtered = users.filter(u => {
    if (filterType && u.accountType !== filterType) return false
    if (filterPlan && u.plan !== filterPlan) return false
    if (filterStatus === 'active' && !u.isActive) return false
    if (filterStatus === 'suspended' && u.isActive) return false
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const planBadge: Record<string, string> = {
    BASIC: 'bg-gray-100 text-gray-700',
    PLUS: 'bg-blue-100 text-blue-700',
    ENTERPRISE: 'bg-purple-100 text-purple-700',
  }

  const typeBadge: Record<string, string> = {
    SUPERADMIN: 'bg-red-100 text-red-700',
    ACCOUNTANT: 'bg-[#1B4965]/10 text-[#1B4965]',
    INDIVIDUAL: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: t('admin.totalAccounts'), value: metrics.totalAccounts },
            { label: t('admin.totalAccountants'), value: metrics.totalAccountants },
            { label: t('admin.totalIndividuals'), value: metrics.totalIndividuals },
            { label: t('admin.totalBusinesses'), value: metrics.totalBusinesses },
            { label: t('admin.totalTx'), value: metrics.totalTx },
            { label: t('admin.aiUsage'), value: metrics.aiUsage },
          ].map(m => (
            <div key={m.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-[#1B4965]">{m.value}</p>
              <p className="text-xs text-gray-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="input text-sm"
            placeholder={t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{t('admin.allTypes')}</option>
            <option value="ACCOUNTANT">{t('role.accountant')}</option>
            <option value="INDIVIDUAL">{t('role.individual')}</option>
          </select>
          <select className="input text-sm" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
            <option value="">{t('admin.allPlans')}</option>
            <option value="BASIC">{t('plan.basic')}</option>
            <option value="PLUS">{t('plan.plus')}</option>
            <option value="ENTERPRISE">{t('plan.enterprise')}</option>
          </select>
          <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{t('admin.allStatus')}</option>
            <option value="active">{t('admin.active')}</option>
            <option value="suspended">{t('admin.suspended')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('auth.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.plan')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.businesses')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.lastLogin')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{user.name || '—'}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[user.accountType] || ''}`}>
                        {user.accountType === 'SUPERADMIN' ? t('role.superadmin') : user.accountType === 'ACCOUNTANT' ? t('role.accountant') : t('role.individual')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                        value={user.plan}
                        onChange={e => changePlan(user, e.target.value)}
                        disabled={actionLoading === user.id || user.accountType === 'SUPERADMIN'}
                      >
                        <option value="BASIC">{t('plan.basic')}</option>
                        <option value="PLUS">{t('plan.plus')}</option>
                        <option value="ENTERPRISE">{t('plan.enterprise')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user._count?.businessUsers ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : t('admin.never')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {user.isActive ? t('admin.active') : t('admin.suspended')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.accountType !== 'SUPERADMIN' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStatus(user)}
                            disabled={actionLoading === user.id}
                            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                              user.isActive
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {user.isActive ? t('admin.suspend') : t('admin.activate')}
                          </button>
                          <button
                            onClick={() => deleteUser(user)}
                            disabled={actionLoading === user.id}
                            title="Eliminar usuario"
                            className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">{t('common.noData')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
