'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useActiveBiz } from '@/lib/use-active-biz'

type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface AssignmentNote {
  id: string
  note: string
  createdAt: string
  user: { id: string; name: string | null; email: string }
}

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
  notes: AssignmentNote[]
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_BORDER: Record<Status, string> = {
  PENDING: 'border-yellow-400',
  IN_PROGRESS: 'border-blue-500',
  COMPLETED: 'border-emerald-500',
  CANCELLED: 'border-gray-300',
}

const STATUS_ICONS: Record<Status, string> = {
  PENDING: '⏳',
  IN_PROGRESS: '🔄',
  COMPLETED: '✅',
  CANCELLED: '✕',
}

function StatusPicker({ current, onChange, disabled }: { current: Status; onChange: (s: Status) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${STATUS_COLORS[current]} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
      >
        <span>{STATUS_ICONS[current]}</span>
        <span>{STATUS_LABELS[current]}</span>
        {!disabled && <span className="opacity-60 text-[10px]">▾</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
          {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors text-left ${s === current ? 'bg-gray-50' : ''}`}
            >
              <span>{STATUS_ICONS[s]}</span>
              <span>{STATUS_LABELS[s]}</span>
              {s === current && <span className="ml-auto text-[#1B4965]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesPanel({
  assignment,
  myId,
  canEdit,
  onNoteAdded,
  onNoteDeleted,
}: {
  assignment: Assignment
  myId: string
  canEdit: boolean
  onNoteAdded: (note: AssignmentNote) => void
  onNoteDeleted: (noteId: string) => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/assignments/${assignment.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: text }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      onNoteAdded(data)
      setText('')
    } else {
      const d = await res.json()
      setError(d.error || 'Error al guardar nota')
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('¿Eliminar esta nota?')) return
    const res = await fetch(`/api/assignments/${assignment.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (res.ok) onNoteDeleted(noteId)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Notes list */}
      {assignment.notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic mb-3">Sin notas aún.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {assignment.notes.map(n => (
            <div key={n.id} className="flex gap-2 group">
              <div className="w-6 h-6 rounded-full bg-[#1B4965] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {(n.user.name || n.user.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">{n.user.name || n.user.email}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {n.user.id === myId && (
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="text-[10px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{n.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add note input */}
      {canEdit && (
        <div className="flex gap-2">
          <textarea
            rows={2}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1B4965] focus:ring-1 focus:ring-[#1B4965]/20 resize-none placeholder-gray-300"
            placeholder="Agregar nota o comentario..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }}
          />
          <button
            onClick={addNote}
            disabled={saving || !text.trim()}
            className="px-3 py-2 bg-[#1B4965] text-white rounded-lg text-xs font-semibold hover:bg-[#143A52] disabled:opacity-40 transition-colors self-end"
          >
            {saving ? '...' : 'Agregar'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {canEdit && <p className="text-[10px] text-gray-300 mt-1">Ctrl+Enter para enviar</p>}
    </div>
  )
}

export default function AsignacionesPage() {
  const { data: session } = useSession()
  const { activeBizId, activeRole } = useActiveBiz()
  const isViewer = activeRole === 'VIEWER'
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  async function deleteAssignment(id: string) {
    if (!confirm('¿Eliminar esta asignación?')) return
    await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  function handleNoteAdded(assignmentId: string, note: AssignmentNote) {
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId ? { ...a, notes: [...a.notes, note] } : a
    ))
  }

  function handleNoteDeleted(assignmentId: string, noteId: string) {
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId ? { ...a, notes: a.notes.filter(n => n.id !== noteId) } : a
    ))
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
        {!isViewer && <button onClick={openNew} className="btn-primary">+ Nueva asignación</button>}
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
          <p className="text-sm text-gray-400 mt-1">{isViewer ? 'No tienes asignaciones pendientes.' : 'Crea una asignación para empezar a delegar trabajo.'}</p>
          {!isViewer && <button onClick={openNew} className="btn-primary mt-5">+ Nueva asignación</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const isExpanded = expandedId === a.id
            const canEditAssignment = !isViewer || a.assignedTo?.id === myId
            const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'

            return (
              <div key={a.id} className={`card border-l-4 transition-all ${STATUS_BORDER[a.status]}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status picker */}
                        <StatusPicker
                          current={a.status}
                          onChange={(s) => changeStatus(a.id, s)}
                          disabled={!canEditAssignment}
                        />
                        {isOverdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                            ⚠ Vencida
                          </span>
                        )}
                        {a.dueDate && !isOverdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            📅 {new Date(a.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                        {a.notes.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            💬 {a.notes.length}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-800 mt-1.5">{a.title}</h3>
                      {a.description && <p className="text-sm text-gray-500 mt-0.5">{a.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>Por <strong className="text-gray-600">{a.createdBy.name || a.createdBy.email}</strong></span>
                        {a.assignedTo ? (
                          <span>→ <strong className="text-[#1B4965]">{a.assignedTo.name || a.assignedTo.email}</strong></span>
                        ) : (
                          <span className="text-orange-500 font-medium">Sin asignar</span>
                        )}
                        <span>{new Date(a.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Notes toggle */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          isExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Ver / agregar notas"
                      >
                        💬 Notas
                      </button>
                      {!isViewer && (
                        <>
                          <button onClick={() => openEdit(a)} className="text-xs text-[#1B4965] hover:underline font-medium px-1">Editar</button>
                          <button onClick={() => deleteAssignment(a.id)} className="text-xs text-red-400 hover:text-red-600 font-medium px-1">✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes panel */}
                  {isExpanded && (
                    <NotesPanel
                      assignment={a}
                      myId={myId}
                      canEdit={canEditAssignment}
                      onNoteAdded={(note) => handleNoteAdded(a.id, note)}
                      onNoteDeleted={(noteId) => handleNoteDeleted(a.id, noteId)}
                    />
                  )}
                </div>
              </div>
            )
          })}
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
                <input className="input w-full" placeholder="Título de la asignación" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea className="input w-full min-h-[70px] resize-none" placeholder="Detalles de la tarea..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                          form.status === s
                            ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {STATUS_ICONS[s]} {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
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
