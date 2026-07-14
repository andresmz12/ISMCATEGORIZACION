'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useActiveBiz } from '@/lib/use-active-biz'
import { useToast } from '@/components/Toast'

interface PlaidAccount {
  id: string
  name: string
  mask: string | null
  type: string
}

interface PlaidConnection {
  id: string
  institutionName: string
  lastSyncAt: string | null
  createdAt: string
  accounts: PlaidAccount[]
}

declare global {
  interface Window {
    Plaid: {
      create: (config: any) => { open: () => void; destroy: () => void }
    }
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PlaidPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const { activeBizId } = useActiveBiz()
  const toast = useToast()

  const accountType = (session?.user as any)?.accountType
  const plan = (session?.user as any)?.plan || 'BASIC'
  const isPlaidEnabled = accountType === 'SUPERADMIN' || plan === 'PLUS' || plan === 'ENTERPRISE' || plan === 'CUSTOM'

  const [connections, setConnections] = useState<PlaidConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)

  const loadConnections = useCallback(async () => {
    if (!activeBizId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/plaid/connections?businessId=${activeBizId}`)
      if (res.ok) setConnections(await res.json())
    } finally {
      setLoading(false)
    }
  }, [activeBizId])

  useEffect(() => { loadConnections() }, [loadConnections])

  // Load Plaid Link script on demand
  function loadPlaidScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Plaid) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
      script.onload = () => resolve()
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  async function handleConnect() {
    if (!activeBizId) return
    setConnecting(true)
    try {
      await loadPlaidScript()

      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: activeBizId }),
      })
      if (!res.ok) {
        toast(t('plaid.connectError'), 'error')
        return
      }
      const { link_token } = await res.json()

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (public_token: string, metadata: any) => {
          try {
            const exchRes = await fetch('/api/plaid/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                public_token,
                businessId: activeBizId,
                institutionName: metadata.institution?.name || 'Bank',
                accounts: metadata.accounts,
              }),
            })
            if (!exchRes.ok) throw new Error('exchange failed')
            toast('Banco conectado correctamente', 'success')
            loadConnections()
          } catch {
            toast(t('plaid.connectError'), 'error')
          }
        },
        onExit: () => setConnecting(false),
      })
      handler.open()
    } catch {
      toast(t('plaid.connectError'), 'error')
      setConnecting(false)
    }
  }

  async function handleSync(connectionId: string) {
    if (!activeBizId) return
    setSyncingId(connectionId)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, businessId: activeBizId }),
      })
      if (!res.ok) {
        toast(t('plaid.syncError'), 'error')
        return
      }
      const { imported, duplicates } = await res.json()
      toast(
        t('plaid.syncDone', { imported, duplicates }),
        imported > 0 ? 'success' : 'info',
      )
      loadConnections()
    } catch {
      toast(t('plaid.syncError'), 'error')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!activeBizId) return
    setDisconnectingId(connectionId)
    try {
      const res = await fetch(
        `/api/plaid/connections?connectionId=${connectionId}&businessId=${activeBizId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        toast(t('plaid.disconnectError'), 'error')
        return
      }
      toast('Cuenta desconectada', 'success')
      setConnections(prev => prev.filter(c => c.id !== connectionId))
    } catch {
      toast(t('plaid.disconnectError'), 'error')
    } finally {
      setDisconnectingId(null)
      setConfirmDisconnect(null)
    }
  }

  // Coming soon — bank connection module not launched yet.
  // Remove this block to re-enable the feature; everything below it still works.
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
      <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
        Próximamente
      </div>
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1B4965]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Conexión bancaria — módulo próximamente</h1>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        Estamos trabajando en la conexión directa con tu banco. Mientras tanto, puedes seguir subiendo tu estado de cuenta manualmente desde{' '}
        <a href="/clasificar" className="text-[#1B4965] font-semibold underline">Clasificar con IA</a>.
      </p>
    </div>
  )

  // Upgrade wall for BASIC plan
  if (!isPlaidEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1B4965] to-[#2EC4B6] text-white text-xs font-bold px-3 py-1 rounded-full">
          {t('plaid.premiumBadge')}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('plaid.upgradeTitle')}</h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">{t('plaid.upgradeDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
          {[
            'Conecta Chase, Bank of America, Wells Fargo y más',
            'Sin importar archivos CSV manualmente',
            'Nuevas transacciones siempre disponibles con un clic',
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <svg className="w-4 h-4 text-[#2EC4B6] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-gray-700">{f}</span>
            </div>
          ))}
        </div>
        <a href="/settings" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#1B4965] to-[#2EC4B6] text-white hover:opacity-90 transition-opacity">
          {t('plaid.upgradeBtn')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('plaid.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('plaid.subtitle')}</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting || !activeBizId}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#1B4965] to-[#2EC4B6] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {connecting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          {t('plaid.connect')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Cuentas conectadas</h2>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{t('auth.loading')}</div>
        ) : connections.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-gray-400 text-sm">{t('plaid.noConnections')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {connections.map(conn => (
              <div key={conn.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1B4965] to-[#2EC4B6] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{conn.institutionName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('plaid.accounts', { n: conn.accounts.length })}
                      {conn.accounts.slice(0, 3).map(a => (
                        <span key={a.id} className="ml-1.5 bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">
                          {a.name}{a.mask ? ` ••${a.mask}` : ''}
                        </span>
                      ))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {conn.lastSyncAt
                        ? t('plaid.lastSync', { date: formatDate(conn.lastSyncAt) ?? '' })
                        : t('plaid.neverSynced')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncingId === conn.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2EC4B6]/10 text-[#2EC4B6] hover:bg-[#2EC4B6]/20 transition-colors disabled:opacity-50"
                  >
                    {syncingId === conn.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {syncingId === conn.id ? t('plaid.syncing') : t('plaid.sync')}
                  </button>

                  {confirmDisconnect === conn.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">¿Confirmar?</span>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={disconnectingId === conn.id}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {disconnectingId === conn.id ? t('plaid.disconnecting') : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmDisconnect(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDisconnect(conn.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                    >
                      {t('plaid.disconnect')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3">
        <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-700">
          Las transacciones sincronizadas llegan con estado <strong>Pendiente</strong> y quedan listas para clasificar con IA en la sección <strong>Clasificar con IA</strong>. La sincronización es incremental — solo trae transacciones nuevas cada vez.
        </p>
      </div>
    </div>
  )
}
