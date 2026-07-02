'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

type Step = 1 | 2

function StepDot({ n, current, label }: { n: number; current: number; label: string }) {
  const done = current > n
  const active = current === n
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0 ${done ? 'bg-[#2EC4B6] border-[#2EC4B6] text-white' : active ? 'bg-white/15 border-white text-white' : 'border-white/20 text-white/30'}`}>
        {done
          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          : n
        }
      </div>
      <span className={`text-sm transition-opacity ${active ? 'text-white font-medium' : done ? 'text-white/70' : 'text-white/30'}`}>{label}</span>
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firmName, setFirmName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  async function handleSubmit() {
    if (!termsAccepted) { setError('Debes aceptar los Términos de Uso para continuar'); return }
    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t('auth.passwordShort')); return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, firmName, termsAccepted }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || t('common.error'))
        return
      }
      router.push('/signin?registered=1')
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-[#1B4965] focus:ring-2 focus:ring-[#1B4965]/10 transition-all'

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
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Crear cuenta</p>
          <StepDot n={1} current={step} label="Tus datos" />
          <StepDot n={2} current={step} label="Tu despacho" />

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-white/80 text-base font-semibold leading-snug">
              Organiza tus finanzas.<br />Simplifica tus impuestos.
            </p>
            <p className="text-white/40 text-sm mt-2">Configuración en menos de 2 minutos.</p>
          </div>
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

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">{t('register.step2.title')}</h2>
                <p className="text-sm text-gray-400 mb-8">Crea tus credenciales de acceso</p>

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.name')}</label>
                    <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="María López" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                    <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                    <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.passwordShort')} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.confirmPassword')}</label>
                    <input className={inputCls} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!name || !email || !password || !confirmPassword) { setError(t('common.required')); return }
                    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
                    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { setError(t('auth.passwordShort')); return }
                    setError('')
                    setStep(2)
                  }}
                  className="w-full h-11 mt-6 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ background: '#1B4965' }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#143A52' }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#1B4965' }}
                >
                  {t('common.next')} →
                </button>

                <p className="text-center text-sm text-gray-400 mt-5">
                  {t('auth.hasAccount')}{' '}
                  <Link href="/signin" className="text-[#1B4965] font-semibold hover:underline">{t('auth.signIn')}</Link>
                </p>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">{t('register.step3b.title')}</h2>
                <p className="text-sm text-gray-400 mb-8">Casi listo — un último paso</p>

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.firmName')} <span className="text-gray-300 font-normal">(opcional)</span></label>
                  <input className={inputCls} value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="García & Asociados LLC" />
                </div>

                <div className="flex items-start gap-3 mt-6">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#1B4965] cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-600 leading-snug cursor-pointer">
                    Acepto los{' '}
                    <Link href="/terms" target="_blank" className="text-[#1B4965] font-medium underline hover:text-[#143A52]">
                      Términos de Uso
                    </Link>{' '}
                    y la{' '}
                    <Link href="/privacy" target="_blank" className="text-[#1B4965] font-medium underline hover:text-[#143A52]">
                      Política de Privacidad
                    </Link>
                  </label>
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep(1)} className="h-11 px-5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    ← {t('common.back')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !termsAccepted}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                    style={{ background: '#1B4965' }}
                    onMouseEnter={e => { if (!loading && termsAccepted) (e.target as HTMLButtonElement).style.background = '#143A52' }}
                    onMouseLeave={e => { if (!loading && termsAccepted) (e.target as HTMLButtonElement).style.background = '#1B4965' }}
                  >
                    {loading ? t('auth.loading') : t('auth.signup')}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
