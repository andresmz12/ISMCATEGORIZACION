'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

const ACTION_LABELS: Record<string, string> = {
  CREATE_BUSINESS: 'Negocio creado',
  INVITE_TEAM_MEMBER: 'Usuario invitado',
  UPDATE_TEAM_MEMBER: 'Usuario actualizado',
  DELETE_TEAM_MEMBER: 'Usuario eliminado',
  UPDATE_SETTINGS: 'Perfil actualizado',
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_BUSINESS: 'bg-emerald-100 text-emerald-700',
  INVITE_TEAM_MEMBER: 'bg-blue-100 text-blue-700',
  UPDATE_TEAM_MEMBER: 'bg-amber-100 text-amber-700',
  DELETE_TEAM_MEMBER: 'bg-red-100 text-red-700',
  UPDATE_SETTINGS: 'bg-gray-100 text-gray-700',
}

export default function AuditoriaPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [businesses, setBusinesses] = useState<any[]>([])
  const [businessId, setBusinessId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBusinesses(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (businessId) params.set('businessId', businessId)
    fetch(`/api/audit?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setLogs(d.logs); setTotal(d.total); setPages(d.pages) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, businessId])

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('audit.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} {t('audit.events')}</p>
        </div>
        {businesses.length > 1 && (
          <select
            className="input w-auto text-sm"
            value={businessId}
            onChange={e => { setBusinessId(e.target.value); setPage(1) }}
          >
            <option value="">{t('common.all')}</option>
            {businesses.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('audit.noEvents')}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{log.user?.name || log.user?.email || '—'}</span>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="text-gray-400 ml-1 text-xs">
                        · {JSON.stringify(log.metadata).slice(0, 80)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                    {log.entity && log.entityId && (
                      <span className="ml-2 text-gray-300">{log.entity} #{log.entityId.slice(-6)}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              {t('tx.prev')}
            </button>
            <span className="text-xs text-gray-500">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              {t('tx.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
