'use client'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

interface Business { id: string; name: string; industry?: string }

interface Props {
  activeBusiness: Business | null
  onSwitch: (biz: Business) => void
}

export function BusinessSwitcher({ activeBusiness, onSwitch }: Props) {
  const { t } = useTranslation()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setBusinesses(data)
      })
      .catch(() => {})
  }, [])

  if (businesses.length <= 1) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left"
      >
        <div className="w-6 h-6 rounded bg-[#2EC4B6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {activeBusiness?.name?.[0] ?? 'B'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {activeBusiness?.name ?? t('business.select')}
          </p>
          <p className="text-xs text-white/60 truncate">{activeBusiness?.industry ?? ''}</p>
        </div>
        <svg className="w-3 h-3 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
          {businesses.map(biz => (
            <button
              key={biz.id}
              onClick={() => { onSwitch(biz); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${activeBusiness?.id === biz.id ? 'bg-blue-50' : ''}`}
            >
              <div className="w-6 h-6 rounded bg-[#1B4965] flex items-center justify-center text-white text-xs font-bold">
                {biz.name[0]}
              </div>
              <span className="text-sm text-gray-800 truncate">{biz.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
