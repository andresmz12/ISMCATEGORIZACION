'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

const INDUSTRIES = [
  'Food Service & Restaurants', 'Retail Trade', 'Professional Services',
  'Healthcare', 'Construction', 'Manufacturing', 'Technology',
  'Real Estate', 'Transportation', 'Other',
]
const ENTITIES = ['Sole Proprietor (Schedule C)', 'S-Corp', 'C-Corp', 'Partnership', 'LLC']

export default function NegociosPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const toast = useToast()
  const accountType = (session?.user as any)?.accountType
  const plan = (session?.user as any)?.plan || 'BASIC'
  const bizLimit = plan === 'CUSTOM' ? Infinity : plan === 'ENTERPRISE' ? 20 : plan === 'PLUS' ? 5 : 1

  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBizId, setActiveBizId] = useState<string>('')
  const [form, setForm] = useState({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', industry: '', entityType: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setActiveBizId(localStorage.getItem('activeBusiness') || '')
    fetch('/api/businesses')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setBusinesses(d)
          if (!localStorage.getItem('activeBusiness') && d.length > 0) {
            setActiveBizId(d[0].id)
            localStorage.setItem('activeBusiness', d[0].id)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || t('business.failed'), 'error'); return }
      setBusinesses(b => [...b, data])
      setForm({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
      localStorage.setItem('activeBusiness', data.id)
      setActiveBizId(data.id)
      toast(t('business.created'), 'success')
    } catch {
      toast(t('business.failed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function setActive(id: string, name: string) {
    localStorage.setItem('activeBusiness', id)
    setActiveBizId(id)
    toast(t('biz.activated').replace('{name}', name), 'info')
  }

  function startEdit(b: any) {
    setEditId(b.id)
    setEditForm({ name: b.name, industry: b.industry || '', entityType: b.entityType || '' })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || t('biz.saveFailed'), 'error'); return }
      setBusinesses(bs => bs.map(b => b.id === id ? { ...b, ...data } : b))
      setEditId(null)
      toast(t('biz.updated'), 'success')
    } catch {
      toast(t('biz.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Se borrarán todas sus transacciones, categorías y datos. Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(t('biz.deleteFailed'), 'error'); return }
    const remaining = businesses.filter(b => b.id !== id)
    setBusinesses(remaining)
    if (activeBizId === id) {
      const next = remaining[0]?.id || ''
      setActiveBizId(next)
      if (next) localStorage.setItem('activeBusiness', next)
      else localStorage.removeItem('activeBusiness')
    }
    toast(t('biz.deleted').replace('{name}', name), 'success')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 text-sm">{t('auth.loading')}</div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('biz.title')}</h1>

      {businesses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('biz.allBusinesses')}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {businesses.map((b: any) => (
              <div key={b.id}>
                {editId === b.id ? (
                  <div className="px-5 py-4 space-y-3">
                    <input
                      className="input w-full"
                      placeholder="Nombre del negocio"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select className="input" value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}>
                        <option value="">— Industria —</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <select className="input" value={editForm.entityType} onChange={e => setEditForm(f => ({ ...f, entityType: e.target.value }))}>
                        <option value="">— Tipo de entidad —</option>
                        {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(b.id)} disabled={saving} className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditId(null)} className="btn-secondary text-sm py-1.5 px-4">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1B4965]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                        {activeBizId === b.id && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Activo</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{[b.industry, b.entityType, b.taxYear].filter(Boolean).join(' · ')}</p>
                      {b.userRole && <span className="text-xs text-[#1B4965] font-medium">{b.userRole}</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {activeBizId !== b.id && (
                        <button onClick={() => setActive(b.id, b.name)} className="text-xs text-gray-400 hover:text-[#1B4965] font-medium">
                          Activar
                        </button>
                      )}
                      {(b.userRole === 'OWNER' || !b.userRole) && (
                        <>
                          <button onClick={() => startEdit(b)} className="text-xs text-[#1B4965] hover:underline font-medium">Editar</button>
                          <button onClick={() => remove(b.id, b.name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {businesses.length === 0 && !loading && (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">{t('biz.noBusinesses')}</p>
        </div>
      )}

      {accountType === 'ACCOUNTANT' && businesses.length >= bizLimit ? (
        <div className="card p-4 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-700">
            Tu plan <span className="font-semibold">{plan}</span> permite hasta {bizLimit === Infinity ? 'negocios ilimitados' : `${bizLimit} negocio(s)`}. Para agregar más, actualiza a un plan superior.
          </p>
        </div>
      ) : accountType === 'TEAM_MEMBER' ? (
        <div className="card p-4 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-700">Los miembros del equipo no pueden crear negocios. Contacta al administrador de tu despacho.</p>
        </div>
      ) : (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.addBusiness')}</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">{t('business.name')} *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My Business LLC"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('business.industry')}</label>
                <select className="input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                  <option value="">{t('common.select')}</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('business.entity')}</label>
                <select className="input" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                  <option value="">{t('common.select')}</option>
                  {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? t('common.loading') : t('business.create')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
