'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  accountType: string
  role: string
}

export default function UsuariosPage() {
  const { t } = useTranslation()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', password: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/team')
      const data = await res.json()
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setError('')
    if (!form.name || !form.email) { setError(t('team.nameEmailRequired')); return }
    setCreating(true)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setError(data.error || t('team.createError')); return }
    setShowModal(false)
    setForm({ name: '', email: '' })
    setInviteUrl(data.inviteUrl || null)
    setCopied(false)
    load()
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (editForm.password && (editForm.password.length < 8 || !/[A-Z]/.test(editForm.password) || !/[0-9]/.test(editForm.password))) { setEditError(t('team.passwordRequirements')); return }
    setSaving(true)
    const body: any = {}
    if (editForm.name) body.name = editForm.name
    if (editForm.password) body.password = editForm.password
    body.isActive = editForm.isActive
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setEditError(data.error || t('biz.saveFailed'))
      return
    }
    setEditId(null)
    load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(t('team.deleteConfirm').replace('{name}', name))) return
    await fetch(`/api/team/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('team.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('team.subtitle')}</p>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }} className="btn-primary">
          {t('team.addUser')}
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : members.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-600 font-medium">{t('team.noMembers')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('team.noMembersHint')}</p>
          <button onClick={() => { setShowModal(true); setError('') }} className="btn-primary mt-5">
            {t('team.addFirstUser')}
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('cat.name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('tx.type')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('team.colEmail')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('team.lastAccess')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  {editId === m.id ? (
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          className="input text-sm w-48"
                          placeholder={t('cat.name')}
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <input
                          className="input text-sm w-48"
                          placeholder={t('settings.newPassword')}
                          type="password"
                          value={editForm.password}
                          onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                          />
                          {t('admin.active')}
                        </label>
                        <button onClick={() => saveEdit(m.id)} disabled={saving} className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50">
                          {saving ? t('common.saving') : t('common.save')}
                        </button>
                        <button onClick={() => { setEditId(null); setEditError('') }} className="btn-secondary text-sm py-1.5 px-3">{t('common.cancel')}</button>
                        {editError && <span className="text-xs text-red-600">{editError}</span>}
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.accountType === 'TEAM_MEMBER' ? 'bg-purple-100 text-purple-700' : m.accountType === 'SUPERADMIN' ? 'bg-red-100 text-red-700' : 'bg-[#1B4965]/10 text-[#1B4965]'}`}>
                          {m.accountType === 'TEAM_MEMBER' ? t('role.team_member') : m.accountType === 'SUPERADMIN' ? t('team.superadmin') : t('role.accountant')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{m.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {m.isActive ? t('admin.active') : t('team.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {m.lastLogin ? new Date(m.lastLogin).toLocaleString() : t('admin.never')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setEditId(m.id); setEditForm({ name: m.name, password: '', isActive: m.isActive }) }}
                            className="text-xs text-[#1B4965] hover:underline font-medium"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => remove(m.id, m.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('team.addModalTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('auth.name')}</label>
                <input
                  className="input w-full"
                  placeholder={t('auth.name')}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('auth.email')}</label>
                <input
                  className="input w-full"
                  type="email"
                  placeholder={t('auth.email')}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-700">{t('team.inviteInfo')}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => { setShowModal(false); setError('') }} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={create} disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? t('team.creating') : t('team.createUser')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite link fallback — shown after creation in case the email fails
          or isn't configured, so the admin always has a way to share access. */}
      {inviteUrl && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('team.userCreatedTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('team.inviteSentText')}
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <code className="text-xs text-gray-700 flex-1 break-all">{inviteUrl}</code>
              <button onClick={copyInviteUrl} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#1B4965] text-white hover:bg-[#153d52] transition-colors flex-shrink-0">
                {copied ? t('team.copied') : t('team.copy')}
              </button>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setInviteUrl(null)} className="btn-secondary">{t('team.done')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
