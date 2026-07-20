'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { BusinessSwitcher } from '@/components/BusinessSwitcher'
import { ChatWidget } from '@/components/ChatWidget'
import { useActiveBiz } from '@/lib/use-active-biz'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { businesses, activeBizId, setActiveBizId, activeRole } = useActiveBiz()
  const activeBusiness = businesses.find(b => b.id === activeBizId) || null
  const [pendingAssignments, setPendingAssignments] = useState(0)

  const accountType = (session?.user as any)?.accountType

  useEffect(() => {
    if (!activeBizId) return
    fetch(`/api/assignments?businessId=${activeBizId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingAssignments(data.filter((a: any) => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length)
        }
      })
      .catch(() => {})
  }, [activeBizId, pathname])

  const navGroups = [
    {
      label: '',
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>) },
        { href: '/clasificar', label: t('nav.classify'), highlight: true, icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>) },
      ],
    },
    {
      label: 'Finanzas',
      items: [
        { href: '/transactions', label: t('nav.transactions'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>) },
        { href: '/import', label: t('nav.import'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>) },
        { href: '/reports', label: t('nav.reports'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>) },
        { href: '/recibos', label: t('nav.receipts'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>) },
        { href: '/plaid', label: t('nav.plaid'), highlight: true, comingSoon: true, icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>) },
      ],
    },
    {
      label: 'Organización',
      items: [
        { href: '/negocios', label: t('nav.businesses'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>) },
        { href: '/usuarios', label: t('nav.team'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>) },
        { href: '/bancos', label: t('nav.banks'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>) },
        { href: '/categorias', label: t('nav.categories'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>) },
        { href: '/rules', label: t('nav.rules'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>) },
        { href: '/documentos', label: 'Documentos', icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>) },
        { href: '/asignaciones', label: 'Asignaciones', badge: pendingAssignments, icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>) },
        { href: '/auditoria', label: t('audit.title'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>) },
        { href: '/settings', label: t('nav.settings'), icon: (<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>) },
      ],
    },
  ]

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/signin')
  }, [status, router])

  // Close sidebar when navigating
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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

  const roleLabel = accountType === 'SUPERADMIN'
    ? t('role.superadmin')
    : accountType === 'TEAM_MEMBER'
      ? t('role.team_member')
      : t('role.accountant')

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-3 py-4' : 'px-4 py-4'}`}>
        <img src="/logo.svg" alt="My Profit and Loss" className="w-8 h-8 flex-shrink-0" />
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">My Profit &amp; Loss</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      {/* Business switcher — shown when user has multiple businesses */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <BusinessSwitcher
            activeBusiness={activeBusiness}
            onSwitch={biz => setActiveBizId(biz.id)}
          />
        </div>
      )}

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-2 ${isCollapsed ? 'px-2 space-y-1' : 'px-3 space-y-3'}`}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !isCollapsed && (
              <>
                {gi > 0 && <div className="mb-2 mt-1 mx-2 h-px" style={{ background: 'linear-gradient(to right, transparent, rgb(255 255 255 / 0.12), transparent)' }} />}
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 px-2 mb-1.5">{group.label}</p>
              </>
            )}
            <div className={isCollapsed ? 'space-y-1' : 'space-y-0.5'}>
              {group.items.map((item: any) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                      isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                    } ${
                      active ? 'nav-item-active' :
                      item.highlight ? 'text-[#2EC4B6] hover:bg-[#2EC4B6]/15' :
                      'text-white/55 hover:bg-white/8 hover:text-white/90'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${active ? 'text-white' : item.highlight ? 'text-[#2EC4B6]' : 'text-white/35'}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="flex items-center gap-1.5 flex-1 min-w-0">
                        {item.label}
                        {item.comingSoon && (
                          <span className="ml-auto bg-white/15 text-white/70 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                            Pronto
                          </span>
                        )}
                        {item.badge > 0 && (
                          <span className="ml-auto bg-[#2EC4B6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {accountType === 'SUPERADMIN' && (
          <div>
            {!isCollapsed && <div className="mb-2 mt-1 mx-2 h-px" style={{ background: 'linear-gradient(to right, transparent, rgb(255 255 255 / 0.12), transparent)' }} />}
            {!isCollapsed && <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 px-2 mb-1.5">Admin</p>}
            <Link
              href="/admin"
              title={isCollapsed ? t('nav.admin') : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
              } ${pathname.startsWith('/admin') ? 'nav-item-active' : 'text-white/55 hover:bg-white/8 hover:text-white/90'}`}
            >
              <span className={`flex-shrink-0 ${pathname.startsWith('/admin') ? 'text-white' : 'text-white/35'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              </span>
              {!isCollapsed && t('nav.admin')}
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={isCollapsed ? 'p-2' : 'px-3 py-3'}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2EC4B6] flex items-center justify-center text-white text-xs font-bold" title={session.user?.name || session.user?.email || ''}>
              {initials}
            </div>
            <button onClick={() => signOut({ callbackUrl: `${window.location.origin}/signin` })} title={t('auth.signout')}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        ) : (
          <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgb(255 255 255 / 0.06)', border: '1px solid rgb(255 255 255 / 0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#2EC4B6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{session.user?.name || session.user?.email}</p>
                <p className="text-[10px] text-white/40 truncate">{roleLabel}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: `${window.location.origin}/signin` })} title={t('auth.signout')}
                className="flex-shrink-0 p-1.5 rounded-lg text-white/35 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Desktop sidebar — collapsible */}
      <aside className={`hidden lg:flex sidebar flex-col flex-shrink-0 overflow-y-auto transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent isCollapsed={collapsed} />
      </aside>

      {/* Mobile sidebar — drawer overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 sidebar flex flex-col lg:hidden transform transition-transform duration-200 ease-in-out overflow-y-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent isCollapsed={false} />
      </aside>

      {/* Main content — fills remaining width, scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header — pinned at top */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile logo + business name */}
          <div className="lg:hidden flex items-center gap-2 min-w-0">
            <img src="/logo.svg" alt="logo" className="w-7 h-7 flex-shrink-0" />
            {activeBusiness && (
              <span className="text-sm font-semibold text-[#1B4965] truncate">{activeBusiness.name}</span>
            )}
          </div>

          {/* Business name — desktop */}
          {activeBusiness && (
            <span className="hidden lg:block text-sm text-gray-500 font-medium truncate">
              {activeBusiness.name}
            </span>
          )}

          <div className="flex-1" />

          <div className="flex items-center">
            <LanguageToggleDark />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Floating chat bubble — chatbotEnabled is account-wide (see
          lib/account.ts): once a superadmin flips it on for an account, it
          applies to every business that account owns, not just one. Hidden
          entirely otherwise. */}
      {(session?.user as any)?.chatbotEnabled && activeBizId && (
        <ChatWidget key={activeBizId} businessId={activeBizId} businessName={activeBusiness?.name || ''} />
      )}
    </div>
  )
}

function LanguageToggleDark() {
  const { locale, setLocale } = useTranslation()
  return (
    <button
      onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
      title="Toggle language"
    >
      <span className="text-base leading-none">{locale === 'es' ? '🇺🇸' : '🇲🇽'}</span>
      <span>{locale === 'es' ? 'EN' : 'ES'}</span>
    </button>
  )
}
