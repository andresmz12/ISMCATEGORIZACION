'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { BusinessSwitcher } from '@/components/BusinessSwitcher'

interface Business { id: string; name: string; industry?: string }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)

  const accountType = (session?.user as any)?.accountType

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    ) },
    { href: '/transactions', label: t('nav.transactions'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    ) },
    { href: '/import', label: t('nav.import'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
    ) },
    { href: '/reports', label: t('nav.reports'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    ) },
    { href: '/rules', label: t('nav.rules'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    ) },
    { href: '/settings', label: t('nav.settings'), icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    ) },
  ]

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/signin')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/businesses')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setActiveBusiness(data[0])
          }
        })
        .catch(() => {})
    }
  }, [status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-[#1B4965] font-semibold text-sm">{t('auth.loading')}</div>
      </div>
    )
  }
  if (!session) return null

  const initials = session.user?.name
    ? session.user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : session.user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1B4965] flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:block ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2EC4B6] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">MP</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">{t('app.short')}</p>
              <p className="text-white/50 text-xs mt-0.5">{t('app.name')}</p>
            </div>
          </div>
        </div>

        {/* Business switcher — ACCOUNTANT only */}
        {accountType === 'ACCOUNTANT' && (
          <div className="px-3 py-3 border-b border-white/10">
            <BusinessSwitcher
              activeBusiness={activeBusiness}
              onSwitch={biz => setActiveBusiness(biz)}
            />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}

          {accountType === 'SUPERADMIN' && (
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-4 ${
                pathname.startsWith('/admin')
                  ? 'bg-white/15 text-white'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              {t('nav.admin')}
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <LanguageToggle />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#2EC4B6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{session.user?.name || session.user?.email}</p>
              <p className="text-xs text-white/50 truncate capitalize">
                {accountType === 'SUPERADMIN' ? t('role.superadmin') : accountType === 'ACCOUNTANT' ? t('role.accountant') : t('role.individual')}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="w-full text-xs text-white/60 hover:text-white py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left px-2"
          >
            {t('auth.signout')}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-[#1B4965] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-white">{t('app.short')}</span>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
