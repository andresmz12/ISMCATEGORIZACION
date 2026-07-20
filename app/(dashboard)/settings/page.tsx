'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

const PAID_PLANS = ['PLUS', 'ENTERPRISE'] as const
const PLAN_RANK: Record<string, number> = { BASIC: 0, PLUS: 1, ENTERPRISE: 2, CUSTOM: 3 }

function SettingsPageInner() {
  const { data: session, update: updateSession } = useSession()
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountType = (session?.user as any)?.accountType
  const accountRole = (session?.user as any)?.accountRole

  const [profile, setProfile] = useState({
    name: '', firmName: '', email: '', plan: '', createdAt: '',
    subscriptionStatus: null as string | null, hasSubscription: false,
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [billingLoading, setBillingLoading] = useState<string | null>(null)

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)

  const [businesses, setBusinesses] = useState<any[]>([])

  function loadProfile() {
    return fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.email) setProfile({
          name: d.name || '', firmName: d.firmName || '', email: d.email, plan: d.plan, createdAt: d.createdAt,
          subscriptionStatus: d.subscriptionStatus ?? null, hasSubscription: !!d.hasSubscription,
        })
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadProfile()
    fetch('/api/businesses')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setBusinesses(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get('checkout') === 'complete') {
      toast(t('settings.checkoutComplete'), 'success')
      router.replace('/settings')
      // The plan activates asynchronously once Square's webhook lands — give
      // it a moment, then refresh so the badge reflects the new plan.
      const timer = setTimeout(loadProfile, 3000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  async function startCheckout(plan: 'PLUS' | 'ENTERPRISE') {
    setBillingLoading(plan)
    const res = await fetch('/api/square/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); setBillingLoading(null); return }
    window.location.href = data.url
  }

  async function manageSubscription(action: 'cancel' | 'resume' | 'swap', plan?: 'PLUS' | 'ENTERPRISE') {
    if (action === 'cancel' && !confirm(t('settings.confirmCancel'))) return
    setBillingLoading(action)
    const res = await fetch('/api/square/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, plan }),
    })
    const data = await res.json()
    setBillingLoading(null)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    toast(data.message, 'success')
    await loadProfile()
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    const body: any = { name: profile.name }
    if (accountType === 'ACCOUNTANT') body.firmName = profile.firmName
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setProfileLoading(false)
    if (!res.ok) { toast((await res.text()) || t('common.error'), 'error'); return }
    const data = await res.json()
    await updateSession({ name: data.name })
    toast(t('settings.profileSaved'), 'success')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast(t('auth.passwordMismatch'), 'error'); return
    }
    if (pwForm.newPassword.length < 8 || !/[A-Z]/.test(pwForm.newPassword) || !/[0-9]/.test(pwForm.newPassword)) {
      toast(t('auth.passwordShort'), 'error'); return
    }
    setPwLoading(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    })
    setPwLoading(false)
    if (!res.ok) { toast((await res.text()) || t('common.error'), 'error'); return }
    const data = await res.json()
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    toast(t('settings.passwordChanged'), 'success')
  }

  const planLabels: Record<string, string> = { BASIC: t('plan.basic'), PLUS: t('plan.plus'), ENTERPRISE: t('plan.enterprise'), CUSTOM: t('plan.custom') }
  const accountLabels: Record<string, string> = { ACCOUNTANT: t('role.accountant'), SUPERADMIN: t('role.superadmin'), TEAM_MEMBER: t('role.team_member') }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Account info card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1B4965] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {profile.name ? profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-base truncate">{profile.name || '—'}</p>
          <p className="text-sm text-gray-500 truncate">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1B4965]/10 text-[#1B4965] font-medium">{accountLabels[accountType] || accountType}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#2EC4B6]/10 text-[#2EC4B6] font-medium">{planLabels[profile.plan] || profile.plan}</span>
          </div>
        </div>
        {profile.createdAt && (
          <p className="text-xs text-gray-400 flex-shrink-0">{t('settings.memberSince')}: {new Date(profile.createdAt).toLocaleDateString()}</p>
        )}
      </div>

      {/* Billing */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.billing')}</h2>

        {profile.subscriptionStatus === 'PAYMENT_FAILED' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
            {t('settings.subscriptionPaymentFailed')}
          </div>
        )}
        {profile.subscriptionStatus === 'CANCELED' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-sm">
            {t('settings.subscriptionCanceled')}
          </div>
        )}

        {accountRole !== 'OWNER' ? (
          <p className="text-sm text-gray-400">{t('settings.ownerOnlyBilling')}</p>
        ) : profile.hasSubscription ? (
          // Real Square subscription — swapping either up or down is a legitimate
          // billing change (labeled "change to", never "upgrade"), and there's an
          // actual subscription behind it to cancel/resume.
          <div className="flex flex-wrap gap-2">
            {PAID_PLANS.filter(p => p !== profile.plan).map(plan => (
              <button
                key={plan}
                onClick={() => manageSubscription('swap', plan)}
                disabled={billingLoading !== null}
                className="btn-primary disabled:opacity-50"
              >
                {billingLoading === 'swap' ? t('common.loading') : t('settings.changeTo').replace('{plan}', planLabels[plan])}
              </button>
            ))}

            {profile.subscriptionStatus !== 'CANCELED' ? (
              <button
                onClick={() => manageSubscription('cancel')}
                disabled={billingLoading !== null}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                {billingLoading === 'cancel' ? t('common.loading') : t('settings.cancelSubscription')}
              </button>
            ) : (
              <button
                onClick={() => manageSubscription('resume')}
                disabled={billingLoading !== null}
                className="px-4 py-2 text-sm font-medium text-[#1B4965] bg-[#1B4965]/10 rounded-lg hover:bg-[#1B4965]/20 disabled:opacity-50"
              >
                {billingLoading === 'resume' ? t('common.loading') : t('settings.resumeSubscription')}
              </button>
            )}
          </div>
        ) : (() => {
          // No real Square subscription behind the current plan (e.g. an
          // admin-granted plan) — only offer checkout for plans that are
          // genuinely higher-tier. Never offer a lower/equal plan as an
          // "upgrade", and if there's nothing higher to sell, say so instead
          // of showing a button (there's also nothing to cancel here).
          const currentRank = PLAN_RANK[profile.plan] ?? 0
          const upgradeOptions = PAID_PLANS.filter(p => PLAN_RANK[p] > currentRank)
          if (upgradeOptions.length === 0) {
            return <p className="text-sm text-gray-400">{t('settings.alreadyTopPlan')}</p>
          }
          return (
            <div className="flex flex-wrap gap-2">
              {upgradeOptions.map(plan => (
                <button
                  key={plan}
                  onClick={() => startCheckout(plan)}
                  disabled={billingLoading !== null}
                  className="btn-primary disabled:opacity-50"
                >
                  {billingLoading === plan ? t('common.loading') : t('settings.upgradeTo').replace('{plan}', planLabels[plan])}
                </button>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Profile form */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.profile')}</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="label">{t('auth.name')}</label>
            <input
              className="input"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder={t('auth.name')}
              required
            />
          </div>
          {accountType === 'ACCOUNTANT' && (
            <div>
              <label className="label">{t('auth.firmName')}</label>
              <input
                className="input"
                value={profile.firmName}
                onChange={e => setProfile(p => ({ ...p, firmName: e.target.value }))}
                placeholder="García & Asociados LLC"
              />
            </div>
          )}
          <div>
            <label className="label">{t('auth.email')}</label>
            <input className="input bg-gray-50 text-gray-400" value={profile.email} disabled />
            <p className="text-xs text-gray-400 mt-1">{t('settings.emailReadOnly')}</p>
          </div>
          <button type="submit" disabled={profileLoading} className="btn-primary disabled:opacity-50">
            {profileLoading ? t('common.loading') : t('settings.saveProfile')}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.changePassword')}</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">{t('settings.currentPassword')}</label>
            <input
              className="input"
              type="password"
              value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="label">{t('settings.newPassword')}</label>
            <input
              className="input"
              type="password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label">{t('auth.confirmPassword')}</label>
            <input
              className="input"
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary disabled:opacity-50">
            {pwLoading ? t('common.loading') : t('settings.changePassword')}
          </button>
        </form>
      </div>

      {/* Your businesses */}
      {businesses.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('settings.yourBusinesses')}</h2>
          <div className="space-y-2">
            {businesses.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.name}</p>
                  <p className="text-xs text-gray-400">{b.industry} · {b.entityType} · {b.taxYear}</p>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('activeBusiness', b.id)
                    toast(t('biz.activated').replace('{name}', b.name), 'info')
                  }}
                  className="text-xs text-[#1B4965] font-medium hover:underline flex-shrink-0"
                >
                  {t('business.setActive')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  )
}
