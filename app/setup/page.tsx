'use client'
import { useState } from 'react'
import { resetPassword } from './actions'

export default function SetupPage() {
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('superadmin@mypnl.com')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const result = await resetPassword(secret, email, password)
      if (result.ok) {
        setStatus('ok')
        setMsg(result.message)
      } else {
        setStatus('error')
        setMsg(result.message)
      }
    } catch (err: any) {
      setStatus('error')
      setMsg(err?.message || 'Error inesperado')
    }
  }

  return (
    <div className="min-h-screen bg-[#1B4965] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#2EC4B6] rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Resetear Contraseña</h1>
          <p className="text-sm text-gray-500 mt-1">Requiere <code className="bg-gray-100 px-1 rounded text-xs">ADMIN_RESET_SECRET</code> en Railway</p>
        </div>

        {status === 'ok' ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg p-3">{msg}</p>
            <a
              href="/signin"
              className="block w-full py-2.5 px-4 bg-[#1B4965] text-white rounded-xl text-sm font-semibold text-center hover:bg-[#153d52] transition-colors"
            >
              Ir a Iniciar Sesión →
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email del usuario</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva contraseña</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ADMIN_RESET_SECRET</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                required
                placeholder="El valor que pusiste en Railway"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{msg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 bg-[#1B4965] text-white rounded-xl text-sm font-semibold hover:bg-[#153d52] transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? 'Reseteando...' : 'Resetear contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
