'use client'
import { useEffect, useState } from 'react'

interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
}

export default function UsuariosPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
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
    if (!form.name || !form.email || !form.password) { setError('Todos los campos son requeridos'); return }
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError('Mín. 8 caracteres, una mayúscula y un número'); return }
    setCreating(true)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setError(data.error || 'Error al crear usuario'); return }
    setShowModal(false)
    setForm({ name: '', email: '', password: '' })
    load()
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (editForm.password && (editForm.password.length < 8 || !/[A-Z]/.test(editForm.password) || !/[0-9]/.test(editForm.password))) { setEditError('Mín. 8 caracteres, una mayúscula y un número'); return }
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
      setEditError(data.error || 'Error al guardar')
      return
    }
    setEditId(null)
    load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/team/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios del equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea accesos para tu personal. Cada usuario tiene su propio login y ve los mismos negocios que tú.</p>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }} className="btn-primary">
          + Agregar usuario
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : members.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-600 font-medium">No tienes usuarios en tu equipo</p>
          <p className="text-sm text-gray-400 mt-1">Agrega miembros para que puedan acceder a la plataforma con su propio usuario y contraseña.</p>
          <button onClick={() => { setShowModal(true); setError('') }} className="btn-primary mt-5">
            + Agregar primer usuario
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Correo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Último acceso</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
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
                          placeholder="Nombre"
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <input
                          className="input text-sm w-48"
                          placeholder="Nueva contraseña (opcional)"
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
                          Activo
                        </label>
                        <button onClick={() => saveEdit(m.id)} disabled={saving} className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50">
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => { setEditId(null); setEditError('') }} className="btn-secondary text-sm py-1.5 px-3">Cancelar</button>
                        {editError && <span className="text-xs text-red-600">{editError}</span>}
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {m.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {m.lastLogin ? new Date(m.lastLogin).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setEditId(m.id); setEditForm({ name: m.name, password: '', isActive: m.isActive }) }}
                            className="text-xs text-[#1B4965] hover:underline font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => remove(m.id, m.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Eliminar
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">Agregar usuario al equipo</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                <input
                  className="input w-full"
                  placeholder="Ej: María García"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                <input
                  className="input w-full"
                  type="email"
                  placeholder="correo@empresa.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña temporal</label>
                <input
                  className="input w-full"
                  type="password"
                  placeholder="Mín. 8 car., una mayúscula y un número"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-700">Este usuario podrá iniciar sesión con su correo y contraseña, y verá los mismos negocios que tú.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => { setShowModal(false); setError('') }} className="btn-secondary">Cancelar</button>
              <button onClick={create} disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
