'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

type AccountType = 'ACCOUNTANT' | 'INDIVIDUAL'
type Step = 1 | 2 | 3

function StepDot({ n, current }: { n: number; current: number }) {
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
      <span className={`text-sm transition-opacity ${active ? 'text-white font-medium' : done ? 'text-white/70' : 'text-white/30'}`}>
        {n === 1 ? 'Tipo de cuenta' : n === 2 ? 'Tus datos' : 'Tu negocio'}
      </span>
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [bizName, setBizName] = useState('')
  const [industry, setIndustry] = useState('')
  const [entityType, setEntityType] = useState('')
  const [firmName, setFirmName] = useState('')

  async function handleSubmit() {
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
        body: JSON.stringify({
          name, email, password, accountType,
          firmName: accountType === 'ACCOUNTANT' ? firmName : undefined,
          businessName: accountType === 'INDIVIDUAL' ? bizName : undefined,
          industry, entityType,
        }),
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
  const industries = ['Food Service & Restaurants', 'Retail Trade', 'Construction', 'Health & Wellness', 'Technology', 'Real Estate', 'Consulting', 'Other']
  const entities = ['Sole Proprietor (Schedule C)', 'LLC', 'S-Corp', 'C-Corp', 'Partnership']

  return (
    <div className="min-h-screen flex">
      {/* ─── Left panel ─────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F2B3C 0%, #1B4965 60%, #1a5e82 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3 mb-16">
          <img src="/logo.svg" alt="My Profit and Loss" className="w-10 h-10" />
          <span className="text-white font-bold text-xl tracking-tight">My Profit &amp; Loss</span>
        </div>

        {/* Step indicators */}
        <div className="relative flex-1 flex flex-col justify-center space-y-6">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Crear cuenta</p>
          {[1, 2, 3].map(n => <StepDot key={n} n={n} current={step} />)}

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-white/80 text-base font-semibold leading-snug">
              Organiza tus finanzas.<br />Simplifica tus impuestos.
            </p>
            <p className="text-white/40 text-sm mt-2">Configuración en menos de 2 minutos.</p>
          </div>
        </div>

        <p className="relative text-white/30 text-xs">© 2025 My Profit and Loss</p>
      </div>

      {/* ─── Right panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex justify-between items-center p-6">
          <div className="flex lg:hidden items-center gap-2">
            <img src="/logo.svg" alt="My Profit and Loss" className="w-8 h-8" />
            <span className="text-[#1B4965] font-bold">My Profit &amp; Loss</span>
          </div>
          <div className="lg:ml-auto"><LanguageToggle /></div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-12">
          <div className="w-full max-w-md">

            {/* Step 1 */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">{t('register.step1.title')}</h2>
                <p className="text-sm text-gray-400 mb-8">{t('register.step1.subtitle')}</p>

                <div className="space-y-3">
                  {([
                    {
                      type: 'ACCOUNTANT' as AccountType,
                      label: t('register.accountant.label'),
                      desc: t('register.accountant.desc'),
                      icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8M12 17v4" />
                        </svg>
                      ),
                    },
                    {
                      type: 'INDIVIDUAL' as AccountType,
                      label: t('register.individual.label'),
                      desc: t('register.individual.desc'),
                      icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      ),
                    },
                  ]).map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setAccountType(opt.type)}
                      className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${accountType === opt.type ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${accountType === opt.type ? 'text-[#1B4965]' : 'text-gray-300'}`}>
                        {opt.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                        <p className="text-sm text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${accountType === opt.type ? 'border-[#1B4965] bg-[#1B4965]' : 'border-gray-200'}`}>
                        {accountType === opt.type && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => accountType && setStep(2)}
                  disabled={!accountType}
                  className="w-full h-11 mt-6 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                  style={{ background: '#1B4965' }}
                  onMouseEnter={e => { if (accountType) (e.target as HTMLButtonElement).style.background = '#143A52' }}
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

            {/* Step 2 */}
            {step === 2 && (
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

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(1)} className="h-11 px-5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    ← {t('common.back')}
                  </button>
                  <button
                    onClick={() => {
                      if (!name || !email || !password || !confirmPassword) { setError(t('common.required')); return }
                      if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
                      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { setError(t('auth.passwordShort')); return }
                      setError('')
                      setStep(3)
                    }}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: '#1B4965' }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#143A52' }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#1B4965' }}
                  >
                    {t('common.next')} →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">
                  {accountType === 'ACCOUNTANT' ? t('register.step3b.title') : t('register.step3a.title')}
                </h2>
                <p className="text-sm text-gray-400 mb-8">Casi listo — un último paso</p>

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
                )}

                <div className="space-y-4">
                  {accountType === 'ACCOUNTANT' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.firmName')}</label>
                      <input className={inputCls} value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="García & Asociados LLC" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('business.name')}</label>
                        <input className={inputCls} value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Mi Empresa LLC" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('business.industry')} <span className="text-gray-300 font-normal">(opcional)</span></label>
                        <select className={inputCls} value={industry} onChange={e => setIndustry(e.target.value)}>
                          <option value="">Seleccionar industria</option>
                          {industries.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('business.entity')} <span className="text-gray-300 font-normal">(opcional)</span></label>
                        <select className={inputCls} value={entityType} onChange={e => setEntityType(e.target.value)}>
                          <option value="">Seleccionar tipo</option>
                          {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(2)} className="h-11 px-5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    ← {t('common.back')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || (accountType === 'INDIVIDUAL' && !bizName)}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                    style={{ background: '#1B4965' }}
                    onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#143A52' }}
                    onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1B4965' }}
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
