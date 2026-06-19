'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import es from '@/locales/es'
import en from '@/locales/en'

type Locale = 'es' | 'en'
type TranslationKey = keyof typeof es

export type { TranslationKey }

interface I18nContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const dictionaries: Record<Locale, Record<string, string>> = { es, en }

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null
    if (saved === 'es' || saved === 'en') setLocaleState(saved)
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem('locale', l)
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let str: string = dictionaries[locale][key] ?? dictionaries['es'][key] ?? key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v))
      })
    }
    return str
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used inside I18nProvider')
  return ctx
}
