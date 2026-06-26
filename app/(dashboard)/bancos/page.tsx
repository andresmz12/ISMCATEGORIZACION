'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

export default function BancosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { activeBizId, loading } = useActiveBiz()
  const [mappings, setMappings] = useState<any[]>([])
  const [importHistory, setImportHistory] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!activeBizId) return
    setDataLoading(true)
    setFetchError('')
    fetch(`/api/banks?businessId=${activeBizId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setMappings(Array.isArray(d?.mappings) ? d.mappings : [])
        setImportHistory(Array.isArray(d?.importHistory) ? d.importHistory : [])
      })
      .catch(err => {
        console.error('Banks fetch error:', err)
        setFetchError('No se pudo cargar la información. Intenta recargar la página.')
      })
      .finally(() => setDataLoading(false))
  }, [activeBizId])

  async function deleteMapping(id: string, bankName: string) {
    if (!confirm(t('common.confirm'))) return
    const res = await fetch(`/api/banks?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMappings(m => m.filter(x => x.id !== id))
      toast(`${bankName} ${t('cat.deleted')}`, 'success')
    } else {
      toast(t('common.error'), 'error')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 text-sm">{t('auth.loading')}</div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('banks.title')}</h1>
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{fetchError}</div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{t('banks.savedMappings')}</h2>
        </div>
        {dataLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">{t('auth.loading')}</div>
        ) : mappings.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">{t('banks.noMappings')}</p>
            <p className="text-xs text-gray-300 mt-1">Sube un estado de cuenta en "Clasificar con IA" e ingresa el nombre del banco para guardarlo aquí.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {mappings.map((m: any) => {
              const cols = m.mapping ? Object.entries(m.mapping as Record<string, string>).filter(([, v]) => v) : []
              return (
                <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{m.bankName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('banks.columns')}: {cols.map(([k, v]) => `${k}→${v}`).join(', ')}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{new Date(m.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => deleteMapping(m.id, m.bankName)}
                    className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Import history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{t('banks.importHistory')}</h2>
        </div>
        {dataLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">{t('auth.loading')}</div>
        ) : importHistory.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">{t('banks.noHistory')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {importHistory.map((entry: any) => {
              const meta = entry.metadata || {}
              return (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{meta.file || 'Archivo importado'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {meta.imported ?? 0} importadas · {meta.duplicates ?? 0} duplicadas · {meta.total ?? 0} total
                    </p>
                  </div>
                  <p className="text-xs text-gray-300 flex-shrink-0">{new Date(entry.createdAt).toLocaleDateString()}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
