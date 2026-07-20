'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all'

  async function handleSubmit() {
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mín. 8 caracteres, una mayúscula y un número'); return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, password }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'No se pudo activar la cuenta')
        return
      }
      router.push('/signin?invited=1')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-2/5 flex-col p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F2B3C 0%, #1B4965 60%, #1a5e82 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative flex items-center gap-3 mb-16">
          <img src="/logo.svg" alt="My Profit and Loss" className="w-10 h-10" />
          <span className="text-white font-bold text-xl tracking-tight">My Profit &amp; Loss</span>
        </div>
        <div className="relative flex-1 flex flex-col justify-center space-y-6">
          <p className="text-white/80 text-base font-semibold leading-snug">
            Bienvenido al equipo.<br />Elige tu contraseña para empezar.
          </p>
        </div>
        <p className="relative text-white/30 text-xs">© 2025 My Profit and Loss</p>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        <div className="flex justify-between items-center p-6">
          <div className="flex lg:hidden items-center gap-2">
            <img src="/logo.svg" alt="My Profit and Loss" className="w-8 h-8" />
            <span className="text-[#1B4965] font-bold">My Profit &amp; Loss</span>
          </div>
          <div className="lg:ml-auto"><LanguageToggle /></div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-12">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Activa tu cuenta</h2>
            <p className="text-sm text-gray-400 mb-8">Elige la contraseña que usarás para iniciar sesión</p>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 8 caracteres, una mayúscula y un número" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input className={inputCls} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !password || !confirmPassword}
              className="w-full mt-6 py-3 rounded-lg bg-[#1B4965] text-white text-sm font-semibold hover:bg-[#153d52] transition-colors disabled:opacity-50"
            >
              {loading ? 'Activando...' : 'Activar cuenta e iniciar sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
