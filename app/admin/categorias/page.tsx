'use client'
import { useEffect, useState } from 'react'

interface Category {
  id: string
  name: string
  irsCode: string | null
  description: string | null
  isSystem: boolean
  businessId: string | null
  _count?: { transactions: number }
}

const EMPTY_FORM = { name: '', irsCode: '', description: '', isSystem: true }

export default function AdminCategoriasPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const [editCat, setEditCat] = useState<Category | null>(null)
  const [editForm, setEditForm] = useState({ name: '', irsCode: '', description: '', isSystem: true })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/categories')
    const data = await res.json()
    if (Array.isArray(data)) setCats(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openEdit(cat: Category) {
    setEditCat(cat)
    setEditForm({ name: cat.name, irsCode: cat.irsCode || '', description: cat.description || '', isSystem: cat.isSystem })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editCat) return
    setEditLoading(true)
    setEditError('')
    const res = await fetch(`/api/admin/categories/${editCat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        irsCode: editForm.irsCode || null,
        description: editForm.description || null,
        isSystem: editForm.isSystem,
      }),
    })
    setEditLoading(false)
    if (res.ok) { setEditCat(null); await load() }
    else { const d = await res.json(); setEditError(d.error || 'Error') }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name) { setCreateError('Nombre requerido'); return }
    setCreateLoading(true)
    setCreateError('')
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createForm.name,
        irsCode: createForm.irsCode || null,
        description: createForm.description || null,
        isSystem: createForm.isSystem,
      }),
    })
    setCreateLoading(false)
    if (res.ok) { setShowCreate(false); setCreateForm(EMPTY_FORM); await load() }
    else { const d = await res.json(); setCreateError(d.error || 'Error') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteLoading(false)
    if (res.ok) { setDeleteTarget(null); await load() }
    else { const d = await res.json(); setDeleteError(d.error || 'Error al eliminar') }
  }

  const filtered = cats.filter(c => {
    if (filterType === 'system' && !c.isSystem) return false
    if (filterType === 'custom' && c.isSystem) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cats.length} categorías en total · {cats.filter(c => c.isSystem).length} del sistema</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateForm(EMPTY_FORM); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4965] text-white text-sm font-semibold rounded-lg hover:bg-[#143A52] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          Nueva categoría
        </button>
      </div>

      <div className="card p-4 flex gap-3">
        <input
          className="input text-sm flex-1"
          placeholder="Buscar categoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-sm w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todas</option>
          <option value="system">Del sistema</option>
          <option value="custom">Personalizadas</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código IRS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Transacciones</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(cat => (
                  <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      {cat.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{cat.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{cat.irsCode || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.isSystem ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {cat.isSystem ? 'Sistema' : 'Personalizada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cat._count?.transactions ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(cat); setDeleteError('') }}
                          className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No se encontraron categorías</div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editCat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Editar categoría</h2>
                <p className="text-xs text-gray-400 mt-0.5">ID: {editCat.id}</p>
              </div>
              <button onClick={() => setEditCat(null)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{editError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Código IRS</label>
                <input className={inputCls} value={editForm.irsCode} onChange={e => setEditForm(f => ({ ...f, irsCode: e.target.value }))} placeholder="ej. 26-Travel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea className={inputCls} rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Tipo:</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={editForm.isSystem} onChange={() => setEditForm(f => ({ ...f, isSystem: true }))} />
                  <span className="text-xs">Sistema</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={!editForm.isSystem} onChange={() => setEditForm(f => ({ ...f, isSystem: false }))} />
                  <span className="text-xs">Personalizada</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditCat(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={editLoading} className="flex-1 h-10 bg-[#1B4965] text-white rounded-lg text-sm font-semibold hover:bg-[#143A52] disabled:opacity-60">
                  {editLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Nueva categoría</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{createError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input className={inputCls} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Marketing Digital" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Código IRS</label>
                <input className={inputCls} value={createForm.irsCode} onChange={e => setCreateForm(f => ({ ...f, irsCode: e.target.value }))} placeholder="ej. 26-Travel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea className={inputCls} rows={2} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción de la categoría..." />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Tipo:</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={createForm.isSystem} onChange={() => setCreateForm(f => ({ ...f, isSystem: true }))} />
                  <span className="text-xs">Sistema (disponible para todos)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={!createForm.isSystem} onChange={() => setCreateForm(f => ({ ...f, isSystem: false }))} />
                  <span className="text-xs">Personalizada</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={createLoading} className="flex-1 h-10 bg-[#1B4965] text-white rounded-lg text-sm font-semibold hover:bg-[#143A52] disabled:opacity-60">
                  {createLoading ? 'Creando...' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Eliminar categoría</h2>
            <p className="text-sm text-gray-600">
              ¿Eliminar <strong>{deleteTarget.name}</strong>?
              {(deleteTarget._count?.transactions ?? 0) > 0
                ? ` Esta categoría tiene ${deleteTarget._count?.transactions} transacciones asignadas y no puede eliminarse.`
                : ' Esta acción no se puede deshacer.'}
            </p>
            {deleteError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{deleteError}</div>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              {(deleteTarget._count?.transactions ?? 0) === 0 && (
                <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                  {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
