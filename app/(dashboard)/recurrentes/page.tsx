'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'
import { formatCurrency } from '@/lib/currency'

const FREQ_LABEL: Record<string, string> = { WEEKLY: 'tx.everyWeek', BIWEEKLY: 'tx.everyTwoWeeks', MONTHLY: 'tx.everyMonth' }

export default function RecurringPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { businesses, activeBizId: activeBiz } = useActiveBiz()
  const fmt = (n: number) => formatCurrency(n, businesses.find(b => b.id === activeBiz)?.currency)

  const [templates, setTemplates] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    description: '', amount: '', type: 'DEBIT', categoryId: '', deductibility: '',
    frequency: 'MONTHLY', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '',
  })

  function load() {
    if (!activeBiz) return
    setLoading(true)
    fetch(`/api/recurring?businessId=${activeBiz}`).then(r => r.ok ? r.json() : []).then(d => {
      setTemplates(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    if (!activeBiz) return
    load()
    fetch(`/api/categories?businessId=${activeBiz}`).then(r => r.ok ? r.json() : []).then(setCategories)
  }, [activeBiz]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBiz || !form.description || !form.amount || !form.startDate) return
    setSaving(true)
    const res = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBiz,
        description: form.description,
        amount: form.amount,
        type: form.type,
        categoryId: form.categoryId || undefined,
        deductibility: form.deductibility || undefined,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        notes: form.notes || undefined,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast(data.error || t('common.error'), 'error'); return }
    setForm({ description: '', amount: '', type: 'DEBIT', categoryId: '', deductibility: '', frequency: 'MONTHLY', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
    setShowForm(false)
    toast(t('recurring.added'), 'success')
    load()
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/recurring/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) { toast(t('common.error'), 'error'); return }
    setTemplates(ts => ts.map(x => x.id === id ? { ...x, active } : x))
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast(t('common.error'), 'error'); return }
    setTemplates(ts => ts.filter(x => x.id !== id))
    setConfirmDelete(null)
    toast(t('common.success'), 'info')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('recurring.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('recurring.subtitle')}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-sm">
          {showForm ? t('common.cancel') : t('recurring.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createTemplate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('recurring.descriptionLabel')}</label>
            <input className="input" placeholder={t('recurring.descriptionPlaceholder')} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
          </div>
          <div>
            <label className="label">{t('recurring.amountLabel')}</label>
            <input type="number" step="0.01" min="0.01" className="input" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">{t('tx.type')}</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="DEBIT">{t('tx.typeDebit')}</option>
              <option value="CREDIT">{t('tx.typeCredit')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('tx.categoryOptional')}</label>
            <select className="input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">{t('tx.unassigned')}</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('recurring.frequencyLabel')}</label>
            <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              <option value="WEEKLY">{t('tx.everyWeek')}</option>
              <option value="BIWEEKLY">{t('tx.everyTwoWeeks')}</option>
              <option value="MONTHLY">{t('tx.everyMonth')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('recurring.startDateLabel')}</label>
            <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
          </div>
          <div>
            <label className="label">{t('recurring.endDateLabel')}</label>
            <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">{t('recurring.endDateHint')}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t('tx.notesOptional')}</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? t('common.saving') : t('recurring.add')}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{t('recurring.list')}</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">{t('recurring.noTemplates')}</p>
            <p className="text-gray-300 text-xs mt-1">{t('recurring.noTemplatesHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {templates.map(tpl => (
              <div key={tpl.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{tpl.description}</p>
                  <p className="text-xs text-gray-400">
                    {t(FREQ_LABEL[tpl.frequency] as any)} · {t('recurring.next')} {new Date(tpl.nextDate).toLocaleDateString()} · {tpl.category?.name || t('tx.unassigned')}
                  </p>
                </div>
                <p className={`amount-sm flex-shrink-0 ${tpl.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {tpl.type === 'CREDIT' ? '+' : '−'}{fmt(tpl.amount)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tpl.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tpl.active ? t('recurring.active') : t('recurring.paused')}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(tpl.id, !tpl.active)} className="btn-secondary text-xs">
                    {tpl.active ? t('recurring.pause') : t('recurring.resume')}
                  </button>
                  {confirmDelete === tpl.id ? (
                    <button onClick={() => deleteTemplate(tpl.id)} className="text-xs text-red-600 font-medium hover:underline">
                      {t('common.confirm')}
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDelete(tpl.id)} className="text-xs text-gray-400 hover:text-red-600">
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
