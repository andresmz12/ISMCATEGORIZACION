'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

export default function CategoriasPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const toast = useToast()

  const { activeBizId, loading } = useActiveBiz()
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', irsCode: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', irsCode: '', description: '' })

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

  function startEdit(c: any) {
    setEditId(c.id)
    setEditForm({ name: c.name, irsCode: c.irsCode || '', description: c.description || '' })
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    setCategories(c => c.map(x => x.id === id ? { ...x, ...data } : x))
    setEditId(null)
    toast('Categoría actualizada', 'success')
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
              <div key={c.id} className="px-5 py-2.5">
                {editId === c.id ? (
                  <div className="space-y-2 py-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input text-sm"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nombre"
                      />
                      <input
                        className="input text-sm"
                        value={editForm.irsCode}
                        onChange={e => setEditForm(f => ({ ...f, irsCode: e.target.value }))}
                        placeholder="Código IRS (opcional)"
                      />
                    </div>
                    <input
                      className="input text-sm"
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Descripción (opcional)"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(c.id)} className="btn-primary text-xs py-1 px-3">Guardar</button>
                      <button onClick={() => setEditId(null)} className="btn-secondary text-xs py-1 px-3">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      {c.irsCode && <p className="text-xs text-gray-400">{c.irsCode}</p>}
                      {c.description && <p className="text-xs text-gray-400 italic">{c.description}</p>}
                    </div>
                    <button onClick={() => startEdit(c)} className="text-xs text-[#1B4965] hover:text-[#153d52] flex-shrink-0 font-medium">
                      Editar
                    </button>
                    <button onClick={() => deleteCategory(c.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">
                      {t('common.delete')}
                    </button>
                  </div>
                )}
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
