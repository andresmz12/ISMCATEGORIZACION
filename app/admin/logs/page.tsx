'use client'
import { useEffect, useState } from 'react'

interface Event {
  ts: string
  type: 'register' | 'login' | 'transaction' | 'ai'
  msg: string
  sub: string
}

const TYPE_STYLE: Record<string, { dot: string; label: string }> = {
  register: { dot: 'bg-emerald-500', label: 'Registro' },
  login:    { dot: 'bg-blue-500',    label: 'Login' },
  transaction: { dot: 'bg-gray-400', label: 'Transacción' },
  ai:       { dot: 'bg-purple-500',  label: 'IA' },
}

export default function LogsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/logs')
      .then(r => r.json())
      .then(d => {
        if (d.events) setEvents(d.events)
        setLoading(false)
      })
  }, [])

  const filtered = filter ? events.filter(e => e.type === filter) : events

  function fmt(ts: string) {
    const d = new Date(ts)
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs de actividad</h1>
          <p className="text-sm text-gray-500 mt-1">Últimos 60 eventos del sistema</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetch('/api/admin/logs').then(r => r.json()).then(d => { if (d.events) setEvents(d.events); setLoading(false) }) }}
          className="text-xs bg-[#1B4965] text-white px-3 py-1.5 rounded-lg hover:bg-[#143A52] transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'register', 'login', 'transaction', 'ai'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${filter === f ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f === '' ? 'Todos' : TYPE_STYLE[f]?.label ?? f}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay eventos registrados</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((ev, i) => {
              const style = TYPE_STYLE[ev.type] ?? { dot: 'bg-gray-300', label: ev.type }
              return (
                <li key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="mt-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full block ${style.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{ev.msg}</p>
                    <p className="text-xs text-gray-400 truncate">{ev.sub}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${style.dot.replace('bg-', 'bg-').replace('500', '100')} text-gray-600`}>
                      {style.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(ev.ts)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
