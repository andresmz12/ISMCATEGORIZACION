'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useActiveBiz } from '@/lib/use-active-biz'

function MetaSummary({ action, meta }: { action: string; meta: any }) {
  const parts: string[] = []
  if (action === 'IMPORT_TRANSACTIONS') {
    if (meta.file) parts.push(meta.file)
    if (meta.imported != null) parts.push(`${meta.imported} importadas`)
    if (meta.duplicates) parts.push(`${meta.duplicates} duplicadas`)
  } else if (action === 'CLASSIFY_TRANSACTIONS') {
    if (meta.total) parts.push(`${meta.total} transacciones`)
    if (meta.autoClassified) parts.push(`${meta.autoClassified} auto`)
    if (meta.needsReview) parts.push(`${meta.needsReview} revisar`)
  } else if (action === 'SCAN_RECEIPT') {
    if (meta.merchant) parts.push(meta.merchant)
    if (meta.amount) parts.push(`$${meta.amount}`)
    if (meta.confidence) parts.push(meta.confidence)
  } else if (action === 'CREATE_TRANSACTION' || action === 'DELETE_TRANSACTION') {
    if (meta.description) parts.push(meta.description)
    if (meta.amount) parts.push(`$${meta.amount}`)
  } else if (action === 'UPDATE_SETTINGS') {
    if (Array.isArray(meta.fields)) parts.push(meta.fields.join(', '))
  } else if (meta.name) {
    parts.push(meta.name)
  }
  if (!parts.length) return null
  return <span className="text-gray-400 ml-1 text-xs">· {parts.join(' · ')}</span>
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_BUSINESS: 'Negocio creado',
  UPDATE_BUSINESS: 'Negocio actualizado',
  DELETE_BUSINESS: 'Negocio eliminado',
  INVITE_TEAM_MEMBER: 'Usuario invitado',
  UPDATE_TEAM_MEMBER: 'Usuario actualizado',
  DELETE_TEAM_MEMBER: 'Usuario eliminado',
  UPDATE_SETTINGS: 'Perfil actualizado',
  IMPORT_TRANSACTIONS: 'Importación',
  CREATE_TRANSACTION: 'Transacción creada',
  UPDATE_TRANSACTION: 'Transacción actualizada',
  DELETE_TRANSACTION: 'Transacción eliminada',
  CLASSIFY_TRANSACTIONS: 'Clasificación IA',
  SCAN_RECEIPT: 'Recibo escaneado',
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_BUSINESS: 'bg-emerald-100 text-emerald-700',
  UPDATE_BUSINESS: 'bg-blue-100 text-blue-700',
  DELETE_BUSINESS: 'bg-red-100 text-red-700',
  INVITE_TEAM_MEMBER: 'bg-blue-100 text-blue-700',
  UPDATE_TEAM_MEMBER: 'bg-amber-100 text-amber-700',
  DELETE_TEAM_MEMBER: 'bg-red-100 text-red-700',
  UPDATE_SETTINGS: 'bg-gray-100 text-gray-700',
  IMPORT_TRANSACTIONS: 'bg-violet-100 text-violet-700',
  CREATE_TRANSACTION: 'bg-emerald-100 text-emerald-700',
  UPDATE_TRANSACTION: 'bg-amber-100 text-amber-700',
  DELETE_TRANSACTION: 'bg-red-100 text-red-700',
  CLASSIFY_TRANSACTIONS: 'bg-[#2EC4B6]/15 text-[#1B8A7A]',
  SCAN_RECEIPT: 'bg-indigo-100 text-indigo-700',
}

export default function AuditoriaPage() {
  const { t } = useTranslation()
  const { businesses, activeBizId } = useActiveBiz()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [businessId, setBusinessId] = useState('')
  const [loading, setLoading] = useState(true)

  // Pre-select active business when available
  useEffect(() => {
    if (activeBizId && !businessId) setBusinessId(activeBizId)
  }, [activeBizId])

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
            onChange={e => { setBusinessId(e.target.value); setPage(1); }}
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
                    {log.metadata && <MetaSummary action={log.action} meta={log.metadata} />}
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
