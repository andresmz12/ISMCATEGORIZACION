'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { estimateTransactionLimit } from '@/lib/ai-pricing'

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
  // Account-wide — shared across every business this account owns (see lib/account.ts).
  aiMonthlyBudgetCents: number | null
  chatbotEnabled: boolean
  aiUsage: { costCents: number; blocked: boolean; unblockedByAdmin: boolean }[]
}

function fmtUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

interface Metrics {
  totalAccounts: number
  totalAccountants: number
  totalTeamMembers: number
  totalBusinesses: number
  totalTx: number
  aiUsage: number
}

const EMPTY_FORM = { name: '', email: '', password: '', plan: 'BASIC', firmName: '' }

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

  // Create account modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  // Reset password
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  // Edit user
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', accountType: '', plan: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // AI budget / chatbot (account-wide) — edited within the same modal
  const [budgetDraft, setBudgetDraft] = useState('')
  const [savingAi, setSavingAi] = useState(false)

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

  function openEdit(user: User) {
    setEditUser(user)
    setEditForm({ name: user.name || '', email: user.email, accountType: user.accountType, plan: user.plan })
    setEditError('')
    setBudgetDraft(user.aiMonthlyBudgetCents != null ? (user.aiMonthlyBudgetCents / 100).toString() : '')
  }

  async function saveAiBudget() {
    if (!editUser) return
    const dollars = budgetDraft === '' ? null : Number(budgetDraft)
    if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) return
    setSavingAi(true)
    await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiMonthlyBudgetCents: dollars === null ? null : Math.round(dollars * 100) }),
    })
    const fresh = await fetch('/api/admin/users').then(r => r.json())
    if (Array.isArray(fresh)) {
      setUsers(fresh)
      setEditUser(fresh.find((u: User) => u.id === editUser.id) || null)
    }
    setSavingAi(false)
  }

  async function toggleChatbotForUser(enabled: boolean) {
    if (!editUser) return
    setSavingAi(true)
    await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotEnabled: enabled }),
    })
    const fresh = await fetch('/api/admin/users').then(r => r.json())
    if (Array.isArray(fresh)) {
      setUsers(fresh)
      setEditUser(fresh.find((u: User) => u.id === editUser.id) || null)
    }
    setSavingAi(false)
  }

  async function unblockAiForUser() {
    if (!editUser) return
    setSavingAi(true)
    await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unblockAiUsage: true }),
    })
    const fresh = await fetch('/api/admin/users').then(r => r.json())
    if (Array.isArray(fresh)) {
      setUsers(fresh)
      setEditUser(fresh.find((u: User) => u.id === editUser.id) || null)
    }
    setSavingAi(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    if (!editForm.email) { setEditError('El correo es requerido'); return }
    setEditLoading(true)
    setEditError('')
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name, email: editForm.email, accountType: editForm.accountType, plan: editForm.plan }),
    })
    setEditLoading(false)
    if (res.ok) { setEditUser(null); await load() }
    else { const d = await res.json(); setEditError(d.error || 'Error al guardar') }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetUser) return
    if (resetPwd.length < 8) { setResetError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(resetPwd)) { setResetError('Debe incluir al menos una letra mayúscula'); return }
    if (!/[0-9]/.test(resetPwd)) { setResetError('Debe incluir al menos un número'); return }
    setResetLoading(true)
    setResetError('')
    const res = await fetch(`/api/admin/users/${resetUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPwd }),
    })
    setResetLoading(false)
    if (res.ok) { setResetUser(null); setResetPwd('') }
    else setResetError('Error al cambiar contraseña')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) { setCreateError('Email y contraseña requeridos'); return }
    if (form.password.length < 8) { setCreateError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(form.password)) { setCreateError('La contraseña debe incluir al menos una letra mayúscula'); return }
    if (!/[0-9]/.test(form.password)) { setCreateError('La contraseña debe incluir al menos un número'); return }
    setCreateLoading(true)
    setCreateError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        plan: form.plan,
        firmName: form.firmName,
      }),
    })
    const data = await res.json()
    setCreateLoading(false)
    if (!res.ok) { setCreateError(data.error || 'Error al crear cuenta'); return }
    setShowCreate(false)
    setForm(EMPTY_FORM)
    await load()
  }

  const filtered = users.filter(u => {
    if (filterType && u.accountType !== filterType) return false
    if (filterPlan && u.plan !== filterPlan) return false
    if (filterStatus === 'active' && !u.isActive) return false
    if (filterStatus === 'suspended' && u.isActive) return false
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const typeBadge: Record<string, string> = {
    SUPERADMIN: 'bg-red-100 text-red-700',
    ACCOUNTANT: 'bg-[#1B4965]/10 text-[#1B4965]',
    TEAM_MEMBER: 'bg-purple-100 text-purple-700',
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); setForm(EMPTY_FORM) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4965] text-white text-sm font-semibold rounded-lg hover:bg-[#143A52] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          Crear cuenta
        </button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: t('admin.totalAccounts'), value: metrics.totalAccounts },
            { label: t('admin.totalAccountants'), value: metrics.totalAccountants },
            { label: t('admin.totalTeamMembers'), value: metrics.totalTeamMembers },
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
            <option value="TEAM_MEMBER">{t('role.team_member')}</option>
          </select>
          <select className="input text-sm" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
            <option value="">{t('admin.allPlans')}</option>
            <option value="NONE">{t('plan.none')}</option>
            <option value="BASIC">{t('plan.basic')}</option>
            <option value="PLUS">{t('plan.plus')}</option>
            <option value="ENTERPRISE">{t('plan.enterprise')}</option>
            <option value="CUSTOM">{t('plan.custom')}</option>
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
                        {user.accountType === 'SUPERADMIN' ? t('role.superadmin') : user.accountType === 'TEAM_MEMBER' ? t('role.team_member') : t('role.accountant')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                        value={user.plan}
                        onChange={e => changePlan(user, e.target.value)}
                        disabled={actionLoading === user.id || user.accountType === 'SUPERADMIN'}
                      >
                        <option value="NONE">{t('plan.none')}</option>
                        <option value="BASIC">{t('plan.basic')}</option>
                        <option value="PLUS">{t('plan.plus')}</option>
                        <option value="ENTERPRISE">{t('plan.enterprise')}</option>
                        <option value="CUSTOM">{t('plan.custom')}</option>
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
                      <div className="flex items-center gap-2">
                        {user.accountType !== 'SUPERADMIN' && (
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
                        )}
                        <button
                          onClick={() => openEdit(user)}
                          disabled={actionLoading === user.id}
                          title="Editar usuario"
                          className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors disabled:opacity-50"
                        >
                          ✏️
                        </button>
                        {user.accountType !== 'SUPERADMIN' && (
                          <>
                            <button
                              onClick={() => { setResetUser(user); setResetPwd(''); setResetError('') }}
                              disabled={actionLoading === user.id}
                              title="Cambiar contraseña"
                              className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors disabled:opacity-50"
                            >
                              🔑
                            </button>
                            <button
                              onClick={() => deleteUser(user)}
                              disabled={actionLoading === user.id}
                              title="Eliminar usuario"
                              className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
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

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cambiar contraseña</h2>
                <p className="text-xs text-gray-400 mt-0.5">{resetUser.email}</p>
              </div>
              <button onClick={() => setResetUser(null)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{resetError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
                <input
                  className={inputCls}
                  type="password"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  placeholder="Contraseña"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres, una mayúscula y un número</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setResetUser(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={resetLoading} className="flex-1 h-10 bg-[#1B4965] text-white rounded-lg text-sm font-semibold hover:bg-[#143A52] transition-colors disabled:opacity-60">
                  {resetLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Editar usuario</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editUser.email}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{editError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                <input
                  className={inputCls}
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="María López"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico *</label>
                <input
                  className={inputCls}
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Correo electrónico"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de cuenta</label>
                  <select
                    className={inputCls}
                    value={editForm.accountType}
                    onChange={e => setEditForm(f => ({ ...f, accountType: e.target.value }))}
                  >
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="TEAM_MEMBER">Miembro de equipo</option>
                    <option value="SUPERADMIN">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                  <select
                    className={inputCls}
                    value={editForm.plan}
                    onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                  >
                    <option value="NONE">Sin plan (bloqueada)</option>
                    <option value="BASIC">Basic</option>
                    <option value="PLUS">Plus</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
              </div>

              {editUser?.accountType === 'ACCOUNTANT' && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Presupuesto de IA (por cuenta)</p>
                  <p className="text-xs text-gray-400 -mt-2">
                    Compartido por todos los negocios de esta cuenta y por los miembros de equipo invitados.
                  </p>

                  {(() => {
                    const usage = editUser.aiUsage[0]
                    const spent = usage?.costCents ?? 0
                    const isBlocked = !!usage?.blocked && !usage?.unblockedByAdmin
                    const draftDollars = budgetDraft === '' ? null : Number(budgetDraft)
                    const estimatedTx = draftDollars != null && Number.isFinite(draftDollars) && draftDollars > 0
                      ? estimateTransactionLimit(Math.round(draftDollars * 100))
                      : null
                    return (
                      <>
                        <p className="text-sm text-gray-700">
                          Gastado este mes: <strong>{fmtUsd(spent)}</strong>
                          {editUser.aiMonthlyBudgetCents != null && <> de <strong>{fmtUsd(editUser.aiMonthlyBudgetCents)}</strong></>}
                        </p>
                        {isBlocked && (
                          <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <span className="text-xs text-red-700 font-medium">Clasificación con IA bloqueada por presupuesto</span>
                            <button type="button" onClick={unblockAiForUser} disabled={savingAi} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                              Reactivar
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className={inputCls}
                            placeholder="Sin límite"
                            value={budgetDraft}
                            onChange={e => setBudgetDraft(e.target.value)}
                          />
                          <button type="button" onClick={saveAiBudget} disabled={savingAi} className="text-xs font-medium px-3 py-2 rounded-lg bg-[#1B4965] text-white hover:bg-[#153d52] transition-colors disabled:opacity-50 whitespace-nowrap">
                            Guardar
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">Límite en USD por mes. Déjalo vacío para no limitar.</p>
                        {estimatedTx != null && (
                          <p className="text-xs text-[#1B4965] font-medium">≈ {estimatedTx.toLocaleString('es-CO')} transacciones clasificadas con IA al mes</p>
                        )}
                      </>
                    )
                  })()}

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">Asistente de chat (IA)</p>
                      <p className="text-xs text-gray-400">{editUser.chatbotEnabled ? 'Habilitado para esta cuenta' : 'Deshabilitado'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleChatbotForUser(!editUser.chatbotEnabled)}
                      disabled={savingAi}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${editUser.chatbotEnabled ? 'bg-[#2EC4B6]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editUser.chatbotEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditUser(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={editLoading} className="flex-1 h-10 bg-[#1B4965] text-white rounded-lg text-sm font-semibold hover:bg-[#143A52] transition-colors disabled:opacity-60">
                  {editLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create account modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Crear cuenta</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{createError}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                <select className={inputCls} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="NONE">Sin plan (bloqueada)</option>
                  <option value="BASIC">Basic</option>
                  <option value="PLUS">Plus</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="María López" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico *</label>
                <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Correo electrónico" required />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label>
                <input className={inputCls} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña" required />
                <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres, una mayúscula y un número</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del despacho (opcional)</label>
                <input className={inputCls} value={form.firmName} onChange={e => setForm(f => ({ ...f, firmName: e.target.value }))} placeholder="García & Asociados" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={createLoading} className="flex-1 h-10 bg-[#1B4965] text-white rounded-lg text-sm font-semibold hover:bg-[#143A52] transition-colors disabled:opacity-60">
                  {createLoading ? 'Creando...' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
