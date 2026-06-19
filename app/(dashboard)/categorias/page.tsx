'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

export default function CategoriasPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const toast = useToast()

  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBizId, setActiveBizId] = useState<string>('')
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', irsCode: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setBusinesses(d)
          const saved = localStorage.getItem('activeBusiness')
          const biz = (saved && d.find((b: any) => b.id === saved)) || d[0]
          setActiveBizId(biz.id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeBizId) return
    fetch(`/api/categories?businessId=${activeBizId}`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [activeBizId])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, businessId: activeBizId }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    setCategories(c => [...c, data])
    setForm({ name: '', irsCode: '', description: '' })
    toast(t('cat.added'), 'success')
  }

  async function deleteCategory(id: string) {
    if (!confirm(t('cat.deleteConfirm'))) return
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCategories(c => c.filter(x => x.id !== id))
      toast(t('cat.deleted'), 'success')
    }
  }

  const systemCats = categories.filter(c => c.isSystem)
  const customCats = categories.filter(c => !c.isSystem)

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 text-sm">{t('auth.loading')}</div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('cat.title')}</h1>
        {businesses.length > 1 && (
          <select
            className="input w-auto text-sm"
            value={activeBizId}
            onChange={e => setActiveBizId(e.target.value)}
          >
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Custom categories form */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('cat.add')}</h2>
        <form onSubmit={addCategory} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('cat.name')} *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Marketing Digital"
                required
              />
            </div>
            <div>
              <label className="label">{t('cat.irsCode')}</label>
              <input
                className="input"
                value={form.irsCode}
                onChange={e => setForm(f => ({ ...f, irsCode: e.target.value }))}
                placeholder="Schedule C Line 8"
              />
            </div>
          </div>
          <div>
            <label className="label">{t('cat.description')}</label>
            <input
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t('common.optional')}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? t('common.loading') : t('common.create')}
          </button>
        </form>
      </div>

      {/* Custom categories */}
      {customCats.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('cat.custom')}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {customCats.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  {c.irsCode && <p className="text-xs text-gray-400">{c.irsCode}</p>}
                </div>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System categories */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{t('cat.system')}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {systemCats.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{c.name}</p>
                {c.irsCode && <p className="text-xs text-gray-400">{c.irsCode}</p>}
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t('cat.system')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
