'use client'
import { useEffect, useState } from 'react'

export default function RulesPage() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBiz, setActiveBiz] = useState<string>('')
  const [rules, setRules] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({ pattern: '', categoryId: '', priority: '0', field: 'description', deductibility: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(data => {
      setBusinesses(data)
      const saved = localStorage.getItem('activeBusiness')
      const biz = (saved && data.find((b: any) => b.id === saved)) || data[0]
      if (biz) setActiveBiz(biz.id)
    })
  }, [])

  useEffect(() => {
    if (!activeBiz) return
    Promise.all([
      fetch(`/api/rules?businessId=${activeBiz}`).then(r => r.json()),
      fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.json()),
    ]).then(([r, c]) => { setRules(r); setCategories(c) })
  }, [activeBiz])

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pattern || !form.categoryId) return
    setLoading(true)
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, businessId: activeBiz, priority: Number(form.priority) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setMsg(data.error); return }
    setRules(r => [...r, data])
    setForm({ pattern: '', categoryId: '', priority: '0', field: 'description', deductibility: '' })
    setMsg('Rule added!')
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    setRules(r => r.filter(x => x.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Classification Rules</h1>
        {businesses.length > 1 && (
          <select className="input w-auto text-sm" value={activeBiz} onChange={e => setActiveBiz(e.target.value)}>
            {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="card p-5 bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">Rules auto-classify future imported transactions. Higher priority = applied first.</p>
      </div>

      {/* Add rule form */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Add New Rule</h2>
        {msg && <div className="mb-3 text-sm text-green-700 font-medium">{msg}</div>}
        <form onSubmit={addRule} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">If {'{field}'} contains</label>
            <input className="input" placeholder="e.g. Amazon, Google Ads" value={form.pattern} onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Field to match</label>
            <select className="input" value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))}>
              <option value="description">Description</option>
              <option value="amount">Amount</option>
            </select>
          </div>
          <div>
            <label className="label">Assign Category</label>
            <select className="input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
              <option value="">— select category —</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Deductibility</label>
            <select className="input" value={form.deductibility} onChange={e => setForm(f => ({ ...f, deductibility: e.target.value }))}>
              <option value="">— not set —</option>
              <option value="YES">Yes (100%)</option>
              <option value="NO">No</option>
              <option value="FIFTY">50%</option>
            </select>
          </div>
          <div>
            <label className="label">Priority (higher = first)</label>
            <input type="number" className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>

      {/* Rules list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pattern</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deduct.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Priority</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No rules yet. Add your first rule above.</td></tr>
            )}
            {rules.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs bg-gray-50 text-gray-700">"{r.pattern}"</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{r.field}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{r.category?.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.deductibility || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.priority}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteRule(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
