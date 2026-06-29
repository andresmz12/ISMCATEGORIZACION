'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useActiveBiz } from '@/lib/use-active-biz'

type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface TeamMember {
  id: string
  name: string
  email: string
}

interface Assignment {
  id: string
  title: string
  description: string | null
  status: Status
  dueDate: string | null
  createdAt: string
  businessId: string
  business: { name: string }
  assignedTo: { id: string; name: string; email: string } | null
  createdBy: { id: string; name: string; email: string }
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export default function AsignacionesPage() {
  const { data: session } = useSession()
  const { activeBizId } = useActiveBiz()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')

  // Create/edit modal
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', assignedToId: '', dueDate: '', status: 'PENDING' as Status })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const myId = (session?.user as any)?.id

  async function load() {
    if (!activeBizId) return
    setLoading(true)
    const [a, t] = await Promise.all([
      fetch(`/api/assignments?businessId=${activeBizId}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ])
    setAssignments(Array.isArray(a) ? a : [])
    setTeam(Array.isArray(t) ? t : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeBizId])

  function openNew() {
    setEditId(null)
    setForm({ title: '', description: '', assignedToId: '', dueDate: '', status: 'PENDING' })
    setFormError('')
    setShowModal(true)
  }

  function openEdit(a: Assignment) {
    setEditId(a.id)
    setForm({
      title: a.title,
      description: a.description || '',
      assignedToId: a.assignedTo?.id || '',
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : '',
      status: a.status,
    })
    setFormError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim()) { setFormError('El título es requerido'); return }
    setSaving(true)
    setFormError('')

    const body: any = {
      title: form.title,
      description: form.description || null,
      assignedToId: form.assignedToId || null,
      dueDate: form.dueDate || null,
    }
    if (!editId) body.businessId = activeBizId
    if (editId) body.status = form.status

    const url = editId ? `/api/assignments/${editId}` : '/api/assignments'
    const res = await fetch(url, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setFormError(d.error || 'Error al guardar')
      return
    }
    setShowModal(false)
    load()
  }

  async function changeStatus(id: string, status: Status) {
    await fetch(`/api/assignments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function deleteAssignment(id: string) {
    if (!confirm('¿Eliminar esta asignación?')) return
    await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
    load()
  }

  const filtered = filterStatus === 'all'
    ? assignments
    : assignments.filter(a => a.status === filterStatus)

  const pendingCount = assignments.filter(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length

  if (!activeBizId) {
    return <div className="card p-10 text-center text-gray-500">Selecciona un negocio para ver sus asignaciones.</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Asignaciones</h1>
            {pendingCount > 0 && (
              <span className="bg-[#1B4965] text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Asigna y da seguimiento a tareas contables de tu equipo.</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nueva asignación</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(s => {
          const count = s === 'all' ? assignments.length : assignments.filter(a => a.status === s).length
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-600 font-medium">Sin asignaciones</p>
          <p className="text-sm text-gray-400 mt-1">Crea una asignación para empezar a delegar trabajo.</p>
          <button onClick={openNew} className="btn-primary mt-5">+ Nueva asignación</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className={`card p-4 border-l-4 ${
              a.status === 'PENDING' ? 'border-yellow-400' :
              a.status === 'IN_PROGRESS' ? 'border-blue-500' :
              a.status === 'COMPLETED' ? 'border-emerald-500' :
              'border-gray-300'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                    {a.dueDate && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
                          ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        📅 {new Date(a.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 mt-1.5">{a.title}</h3>
                  {a.description && <p className="text-sm text-gray-500 mt-1">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                    <span>Creado por <strong className="text-gray-600">{a.createdBy.name || a.createdBy.email}</strong></span>
                    {a.assignedTo ? (
                      <span>→ Asignado a <strong className="text-[#1B4965]">{a.assignedTo.name || a.assignedTo.email}</strong></span>
                    ) : (
                      <span className="text-orange-500 font-medium">Sin asignar</span>
                    )}
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Quick status change */}
                  {a.status === 'PENDING' && (
                    <button onClick={() => changeStatus(a.id, 'IN_PROGRESS')} className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
                      Iniciar
                    </button>
                  )}
                  {a.status === 'IN_PROGRESS' && (
                    <button onClick={() => changeStatus(a.id, 'COMPLETED')} className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
                      Completar
                    </button>
                  )}
                  <button onClick={() => openEdit(a)} className="text-xs text-[#1B4965] hover:underline font-medium">Editar</button>
                  <button onClick={() => deleteAssignment(a.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editId ? 'Editar asignación' : 'Nueva asignación'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input className="input w-full" placeholder="Ej: Contabilidad Q1 - Restaurante Los Arcos" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Notas</label>
                <textarea className="input w-full min-h-[80px] resize-none" placeholder="Detalles de la tarea, pendientes, observaciones..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Asignar a</label>
                  <select className="input w-full" value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    <option value={myId}>Yo mismo</option>
                    {team.filter(m => m.id !== myId).map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite</label>
                  <input type="date" className="input w-full" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              {editId && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select className="input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                    {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
              {formError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              {!editId && form.assignedToId && form.assignedToId !== myId && (
                <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-blue-700">📧 Se enviará un correo de notificación al usuario asignado.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
