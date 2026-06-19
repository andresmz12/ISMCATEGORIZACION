'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function SignInPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
    <div className="min-h-screen flex">
      {/* Left panel — navy gradient */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#1B4965] via-[#2A6080] to-[#143A52]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2EC4B6] rounded-xl flex items-center justify-center">
            <span className="text-sm font-bold text-white">MP</span>
          </div>
          <span className="text-white font-bold text-xl">{t('app.short')}</span>
          <div className="ml-auto">
            <LanguageToggle />
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            {t('app.name')}
          </h1>
          <p className="text-white/70 text-lg">{t('app.tagline')}</p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { icon: '📊', label: 'P&L Reports' },
              { icon: '🤖', label: 'AI Classification' },
              { icon: '📥', label: 'CSV / XLSX Import' },
              { icon: '🧾', label: 'Tax Ready' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-white/80">
                <span>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs">© 2025 My Profit and Loss</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 bg-[#1B4965] rounded-xl flex items-center justify-center">
              <span className="text-xs font-bold text-white">MP</span>
            </div>
            <span className="text-[#1B4965] font-bold text-xl">{t('app.short')}</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('auth.signin')}</h2>
          <p className="text-sm text-gray-500 mb-8">{t('app.tagline')}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
              />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input
                className="input"
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
              className="btn-primary w-full text-center py-2.5 disabled:opacity-60"
            >
              {loading ? t('auth.loading') : t('auth.signin')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="text-[#1B4965] font-semibold hover:underline">{t('auth.register')}</Link>
          </p>

          {process.env.NEXT_PUBLIC_SHOW_DEMO === 'true' && (
            <div className="mt-8 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Demo:</p>
              <p>contador@demo.com / password123</p>
              <p>usuario@demo.com / password123</p>
            </div>
          )}
        </div>

        <div className="mt-6 lg:hidden">
          <LanguageToggle />
        </div>
      </div>
    </div>
  )
}
