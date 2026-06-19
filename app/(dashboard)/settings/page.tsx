'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const { t } = useTranslation()
  const toast = useToast()
  const accountType = (session?.user as any)?.accountType

  const [profile, setProfile] = useState({ name: '', firmName: '', email: '', plan: '', createdAt: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)

  const [businesses, setBusinesses] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.email) setProfile({ name: d.name || '', firmName: d.firmName || '', email: d.email, plan: d.plan, createdAt: d.createdAt })
    })
    fetch('/api/businesses').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setBusinesses(d)
    })
  }, [])

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
    const data = await res.json()
    setProfileLoading(false)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    await updateSession({ name: data.name })
    toast(t('settings.profileSaved'), 'success')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast(t('auth.passwordMismatch'), 'error'); return
    }
    if (pwForm.newPassword.length < 8) {
      toast(t('auth.passwordShort'), 'error'); return
    }
    setPwLoading(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    toast(t('settings.passwordChanged'), 'success')
  }

  const planLabels: Record<string, string> = { BASIC: 'Basic', PLUS: 'Plus', ENTERPRISE: 'Enterprise' }
  const accountLabels: Record<string, string> = { INDIVIDUAL: t('role.individual'), ACCOUNTANT: t('role.accountant'), SUPERADMIN: t('role.superadmin') }

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
              placeholder="Tu nombre"
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
                    toast(b.name, 'info')
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
