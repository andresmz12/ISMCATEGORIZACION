'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signin'); return }
    if (status === 'authenticated' && (session?.user as any)?.accountType !== 'SUPERADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">{t('auth.loading')}</p></div>
  }
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') return null

  const navItems = [
    { href: '/admin', label: t('nav.accounts'), icon: '👥' },
    { href: '/admin/categorias', label: 'Categorías', icon: '🏷️' },
    { href: '/admin/negocios', label: 'Negocios', icon: '🏢' },
    { href: '/admin/plans', label: t('nav.plans'), icon: '📋' },
    { href: '/admin/logs', label: t('nav.logs'), icon: '📄' },
  ]

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-[#143A52] flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2EC4B6] rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-white">MP</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">{t('app.short')}</p>
              <p className="text-white/50 text-xs">{t('nav.admin')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                (item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)) ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div className="pt-4 mt-4 border-t border-white/10">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span>←</span> {t('nav.dashboard')}
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3"><LanguageToggle /></div>
          <p className="text-xs text-white/50 truncate mb-2">{session?.user?.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            {t('auth.signout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
