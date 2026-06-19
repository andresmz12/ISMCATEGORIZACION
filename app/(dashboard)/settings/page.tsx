'use client'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(setBusinesses)
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
    if (!res.ok) { setMsg(data.error || 'Failed'); return }
    setBusinesses(b => [...b, data])
    setForm({ name: '', industry: '', entityType: '', taxYear: new Date().getFullYear().toString() })
    setMsg('Business created!')
    localStorage.setItem('activeBusiness', data.id)
    setTimeout(() => setMsg(''), 3000)
  }

  const INDUSTRIES = ['Food Service & Restaurants','Retail Trade','Professional Services','Healthcare','Construction','Manufacturing','Technology','Real Estate','Transportation','Other']
  const ENTITIES = ['Sole Proprietor (Schedule C)','S-Corp','C-Corp','Partnership','LLC']

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* Existing businesses */}
      {businesses.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Your Businesses</h2>
          <div className="space-y-2">
            {businesses.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.name}</p>
                  <p className="text-xs text-gray-400">{b.industry} · {b.entityType} · {b.taxYear}</p>
                </div>
                <button onClick={() => localStorage.setItem('activeBusiness', b.id)} className="text-xs text-yellow-700 font-medium hover:underline">
                  Set Active
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New business form */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Add Business</h2>
        {msg && <div className="mb-3 text-sm text-green-700 font-medium">{msg}</div>}
        <form onSubmit={createBusiness} className="space-y-4">
          <div>
            <label className="label">Business Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Business LLC" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Industry</label>
              <select className="input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                <option value="">— select —</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Entity Type</label>
              <select className="input" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                <option value="">— select —</option>
                {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Tax Year</label>
            <select className="input w-auto" value={form.taxYear} onChange={e => setForm(f => ({ ...f, taxYear: e.target.value }))}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Business'}
          </button>
        </form>
      </div>
    </div>
  )
}
