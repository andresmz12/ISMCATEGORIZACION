'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.15)" />
      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardMockup() {
  return (
    <div
      className="w-full max-w-[480px] rounded-2xl overflow-hidden shadow-2xl"
      style={{
        transform: 'perspective(1000px) rotateY(-6deg) rotateX(2deg)',
        animation: 'mockupIn 0.8s ease-out both',
      }}
    >
      {/* App topbar */}
      <div className="bg-[#0F2030] px-4 py-2.5 flex items-center gap-2">
        <div className="w-6 h-6 bg-[#2EC4B6] rounded-md flex items-center justify-center">
          <span className="text-white text-[8px] font-bold">MP</span>
        </div>
        <span className="text-white/80 text-xs font-medium">My Profit & Loss</span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Dashboard body */}
      <div className="bg-[#F8FAFC] p-4 space-y-3">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Ingresos', val: '$48,200', color: '#2EC4B6', up: true },
            { label: 'Gastos', val: '$21,840', color: '#EF4444', up: false },
            { label: 'Utilidad', val: '$26,360', color: '#1B4965', up: true },
            { label: 'Deducible', val: '$18,920', color: '#8B5CF6', up: true },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg p-2.5 shadow-sm">
              <p className="text-[8px] text-gray-400 font-medium">{c.label}</p>
              <p className="text-[11px] font-bold text-gray-800 mt-0.5">{c.val}</p>
              <div className="flex items-center gap-0.5 mt-1">
                <span className="text-[7px]" style={{ color: c.up ? '#10b981' : '#ef4444' }}>
                  {c.up ? '↑' : '↓'} 12%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <p className="text-[9px] font-semibold text-gray-600 mb-2">Gastos mensuales</p>
          <div className="flex items-end gap-1 h-16">
            {[45, 62, 38, 75, 55, 80, 48, 65, 52, 70, 42, 88].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{
                height: `${h}%`,
                background: i === 11 ? '#1B4965' : i % 3 === 0 ? '#2EC4B6' : '#e2e8f0',
              }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {['E','F','M','A','M','J','J','A','S','O','N','D'].map(m => (
              <span key={m} className="text-[6px] text-gray-300 flex-1 text-center">{m}</span>
            ))}
          </div>
        </div>

        {/* Transaction list */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-50">
            <p className="text-[9px] font-semibold text-gray-600">Transacciones recientes</p>
          </div>
          {[
            { desc: 'Google Ads — Campaña Nov', cat: 'Publicidad', amt: '-$1,200', ai: true },
            { desc: 'Zoom Pro Subscription', cat: 'Software', amt: '-$149', ai: false },
            { desc: 'Client Payment — Invoice #412', cat: 'Ingresos', amt: '+$8,500', ai: false },
          ].map((tx, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-5 h-5 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-medium text-gray-700 truncate">{tx.desc}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[6px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{tx.cat}</span>
                  {tx.ai && <span className="text-[6px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded">IA</span>}
                </div>
              </div>
              <span className={`text-[9px] font-semibold shrink-0 ${tx.amt.startsWith('+') ? 'text-emerald-600' : 'text-gray-700'}`}>
                {tx.amt}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SignInForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError(t('auth.invalid'))
    else router.push('/dashboard')
  }

  return (
    <>
      <style>{`
        @keyframes mockupIn {
          from { opacity: 0; transform: perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(24px); }
          to   { opacity: 1; transform: perspective(1000px) rotateY(-6deg) rotateX(2deg) translateY(0); }
        }
      `}</style>

      <div className="min-h-screen flex">
        {/* ─── Left panel ─────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-[55%] flex-col p-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F2B3C 0%, #1B4965 60%, #1a5e82 100%)' }}
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />

          {/* Logo */}
          <div className="relative flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-[#2EC4B6] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-sm font-bold text-white">MP</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">MyP&L</span>
          </div>

          {/* Dashboard mockup */}
          <div className="relative flex-1 flex items-center justify-center">
            <DashboardMockup />
          </div>

          {/* Headline */}
          <div className="relative mt-12">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Tus finanzas organizadas.<br />Tus impuestos simplificados.
            </h2>

            {/* Feature pills */}
            <div className="flex gap-6 mt-5">
              {[
                'Clasificación con IA',
                'Reportes P&L',
                'Listo para impuestos',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckIcon />
                  <span className="text-white/80 text-sm">{f}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ─── Right panel ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Language toggle top-right */}
          <div className="flex justify-between items-center p-6">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-8 h-8 bg-[#1B4965] rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">MP</span>
              </div>
              <span className="text-[#1B4965] font-bold">MyP&L</span>
            </div>
            <div className="lg:ml-auto">
              <LanguageToggle />
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-8 pb-12">
            <div className="w-full max-w-sm">
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">Iniciar sesión</h2>
              <p className="text-sm text-gray-400 mb-8">Ingresa a tu cuenta para continuar</p>

              {registered && (
                <div className="mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><circle cx="8" cy="8" r="8" fill="#10b981"/><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ¡Cuenta creada! Ingresa con tus credenciales.
                </div>
              )}

              {error && (
                <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                  <input
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">{t('auth.password')}</label>
                    <span className="text-xs text-[#1B4965] hover:underline cursor-pointer">¿Olvidaste tu contraseña?</span>
                  </div>
                  <input
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                  style={{ background: loading ? '#2A6080' : '#1B4965' }}
                  onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#143A52' }}
                  onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1B4965' }}
                >
                  {loading ? t('auth.loading') : 'Iniciar sesión'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-6">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-[#1B4965] font-semibold hover:underline">Regístrate gratis</Link>
              </p>

              {process.env.NEXT_PUBLIC_SHOW_DEMO === 'true' && (
                <div className="mt-8 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Demo:</p>
                  <p>contador@demo.com / password123</p>
                  <p>usuario@demo.com / password123</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
