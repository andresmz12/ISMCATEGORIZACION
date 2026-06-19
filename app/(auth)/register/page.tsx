'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

type AccountType = 'ACCOUNTANT' | 'INDIVIDUAL'
type Step = 1 | 2 | 3

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
    if (password.length < 8) { setError(t('auth.passwordShort')); return }
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

  const industries = ['Food Service & Restaurants', 'Retail Trade', 'Construction', 'Health & Wellness', 'Technology', 'Real Estate', 'Consulting', 'Other']
  const entities = ['Sole Proprietor (Schedule C)', 'LLC', 'S-Corp', 'C-Corp', 'Partnership']

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 bg-gradient-to-br from-[#1B4965] via-[#2A6080] to-[#143A52]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2EC4B6] rounded-xl flex items-center justify-center">
            <span className="text-sm font-bold text-white">MP</span>
          </div>
          <span className="text-white font-bold text-xl">{t('app.short')}</span>
          <div className="ml-auto"><LanguageToggle /></div>
        </div>

        <div className="space-y-6">
          {([1, 2, 3] as Step[]).map(n => (
            <div key={n} className={`flex items-center gap-3 ${step >= n ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${step >= n ? 'bg-[#2EC4B6] border-[#2EC4B6] text-white' : 'border-white/40 text-white/40'}`}>
                {n}
              </div>
              <span className="text-white text-sm">
                {n === 1 ? t('register.step1.title') : n === 2 ? t('register.step2.title') : accountType === 'ACCOUNTANT' ? t('register.step3b.title') : t('register.step3a.title')}
              </span>
            </div>
          ))}
        </div>

        <p className="text-white/40 text-xs">© 2025 My Profit and Loss</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Step 1 — Type selector */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('register.step1.title')}</h2>
              <p className="text-sm text-gray-500 mb-8">{t('register.step1.subtitle')}</p>

              <div className="space-y-3">
                {([
                  { type: 'ACCOUNTANT' as AccountType, label: t('register.accountant.label'), desc: t('register.accountant.desc'), icon: '🏢' },
                  { type: 'INDIVIDUAL' as AccountType, label: t('register.individual.label'), desc: t('register.individual.desc'), icon: '👤' },
                ]).map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setAccountType(opt.type)}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${accountType === opt.type ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    <span className="text-3xl">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{opt.label}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                    {accountType === opt.type && (
                      <div className="w-5 h-5 rounded-full bg-[#1B4965] flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => accountType && setStep(2)}
                disabled={!accountType}
                className="btn-primary w-full mt-6 py-3 disabled:opacity-40"
              >
                {t('common.next')}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                {t('auth.hasAccount')}{' '}
                <Link href="/signin" className="text-[#1B4965] font-semibold hover:underline">{t('auth.signIn')}</Link>
              </p>
            </div>
          )}

          {/* Step 2 — Account info */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">{t('register.step2.title')}</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="label">{t('auth.name')}</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="María López" required />
                </div>
                <div>
                  <label className="label">{t('auth.email')}</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
                </div>
                <div>
                  <label className="label">{t('auth.password')}</label>
                  <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <div>
                  <label className="label">{t('auth.confirmPassword')}</label>
                  <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">{t('common.back')}</button>
                <button
                  onClick={() => {
                    if (!name || !email || !password || !confirmPassword) { setError(t('common.required')); return }
                    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
                    if (password.length < 8) { setError(t('auth.passwordShort')); return }
                    setError('')
                    setStep(3)
                  }}
                  className="btn-primary flex-1 py-3"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Business / Firm setup */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                {accountType === 'ACCOUNTANT' ? t('register.step3b.title') : t('register.step3a.title')}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <div className="space-y-4">
                {accountType === 'ACCOUNTANT' ? (
                  <div>
                    <label className="label">{t('auth.firmName')}</label>
                    <input className="input" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="García & Asociados LLC" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="label">{t('business.name')}</label>
                      <input className="input" value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Mi Empresa LLC" required />
                    </div>
                    <div>
                      <label className="label">{t('business.industry')}</label>
                      <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
                        <option value="">{t('common.optional')}</option>
                        {industries.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('business.entity')}</label>
                      <select className="input" value={entityType} onChange={e => setEntityType(e.target.value)}>
                        <option value="">{t('common.optional')}</option>
                        {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">{t('common.back')}</button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || (accountType === 'INDIVIDUAL' && !bizName)}
                  className="btn-primary flex-1 py-3 disabled:opacity-60"
                >
                  {loading ? t('auth.loading') : t('auth.signup')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
