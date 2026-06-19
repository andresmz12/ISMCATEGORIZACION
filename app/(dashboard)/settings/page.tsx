'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setBusinesses(d)
    })
  }, [])

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast(data.error || t('business.failed'), 'error'); return }
    setBusinesses(b => [...b, data])
    setForm({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
    toast(t('business.created'), 'success')
    localStorage.setItem('activeBusiness', data.id)
  }

  const INDUSTRIES = [
    'Food Service & Restaurants', 'Retail Trade', 'Professional Services',
    'Healthcare', 'Construction', 'Manufacturing', 'Technology',
    'Real Estate', 'Transportation', 'Other',
  ]
  const ENTITIES = ['Sole Proprietor (Schedule C)', 'S-Corp', 'C-Corp', 'Partnership', 'LLC']

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Existing businesses */}
      {businesses.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">{t('settings.yourBusinesses')}</h2>
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
                  className="text-xs text-[#1B4965] font-medium hover:underline"
                >
                  {t('business.setActive')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New business form */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">{t('settings.addBusiness')}</h2>
        <form onSubmit={createBusiness} className="space-y-4">
          <div>
            <label className="label">{t('business.name')} *</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="My Business LLC"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('business.industry')}</label>
              <select className="input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                <option value="">{t('common.select')}</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('business.entity')}</label>
              <select className="input" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                <option value="">{t('common.select')}</option>
                {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('business.taxYearLabel')}</label>
            <select className="input w-auto" value={form.taxYear} onChange={e => setForm(f => ({ ...f, taxYear: e.target.value }))}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? t('common.loading') : t('business.create')}
          </button>
        </form>
      </div>
    </div>
  )
}
