'use client'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/lib/i18n'
import { ToastProvider } from '@/components/Toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </I18nProvider>
    </SessionProvider>
  )
}
