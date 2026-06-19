'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'

const INDUSTRIES = [
  'Food Service & Restaurants', 'Retail Trade', 'Professional Services',
  'Healthcare', 'Construction', 'Manufacturing', 'Technology',
  'Real Estate', 'Transportation', 'Other',
]
const ENTITIES = ['Sole Proprietor (Schedule C)', 'S-Corp', 'C-Corp', 'Partnership', 'LLC']

export default function NegociosPage() {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const toast = useToast()
  const accountType = (session?.user as any)?.accountType
  const isIndividual = accountType === 'INDIVIDUAL'

  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBusinesses(d) })
      .finally(() => setLoading(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast(data.error || t('business.failed'), 'error'); return }
    setBusinesses(b => [...b, data])
    setForm({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
    localStorage.setItem('activeBusiness', data.id)
    toast(t('business.created'), 'success')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 text-sm">{t('auth.loading')}</div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('biz.title')}</h1>

      {businesses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('biz.allBusinesses')}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {businesses.map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-xl bg-[#1B4965]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#1B4965]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                  <p className="text-xs text-gray-400">{b.industry} · {b.entityType} · {b.taxYear}</p>
                  {b.userRole && <span className="text-xs text-[#1B4965] font-medium">{b.userRole}</span>}
                </div>
                <button
                  onClick={() => { localStorage.setItem('activeBusiness', b.id); toast(b.name, 'info') }}
                  className="text-xs text-[#1B4965] font-medium hover:underline flex-shrink-0"
                >
                  {t('business.setActive')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {businesses.length === 0 && !loading && (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">{t('biz.noBusinesses')}</p>
        </div>
      )}

      {isIndividual && businesses.length >= 1 ? (
        <div className="card p-4 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-700">El plan Independiente incluye un solo negocio. Para agregar más, actualiza a <span className="font-semibold">Plus o Enterprise</span>.</p>
        </div>
      ) : (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.addBusiness')}</h2>
        <form onSubmit={submit} className="space-y-4">
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
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? t('common.loading') : t('business.create')}
          </button>
        </form>
      </div>
      )}
    </div>
  )
}
