'use client'
import { useTranslation } from '@/lib/i18n'

export function LanguageToggle() {
  const { locale, setLocale } = useTranslation()

  return (
    <button
      onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-navy-200 hover:bg-white/10 transition-colors"
      title="Toggle language"
    >
      <span className="text-base">{locale === 'es' ? '🇺🇸' : '🇲🇽'}</span>
      <span>{locale === 'es' ? 'EN' : 'ES'}</span>
    </button>
  )
}
