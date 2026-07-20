import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const host = req.headers.get('host') || ''
    if (host.includes('railway.app') || host.includes('up.railway.app')) {
      const url = req.nextUrl.clone()
      url.host = 'myprofitandloss.com'
      url.port = ''
      return NextResponse.redirect(url, { status: 301 })
    }

    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith('/admin')) {
      if ((token as any)?.accountType !== 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // No active plan (never paid, nothing granted by an admin) — block the
    // whole app except /settings, where they can see billing and pay, or
    // see "ask your account owner" if they're a team member. Superadmins
    // don't have their own plan/billing, so they're exempt.
    const accountType = (token as any)?.accountType
    const plan = (token as any)?.plan
    if (accountType !== 'SUPERADMIN' && plan === 'NONE' && !path.startsWith('/settings')) {
      return NextResponse.redirect(new URL('/settings?blocked=1', req.url))
    }

    // Security headers are set globally via next.config.js headers().
    // Middleware only handles auth-gated redirects.
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/transacciones/:path*',
    '/negocios/:path*',
    '/bancos/:path*',
    '/categorias/:path*',
    '/import/:path*',
    '/reports/:path*',
    '/rules/:path*',
    '/recibos/:path*',
    '/settings/:path*',
    '/usuarios/:path*',
    '/clasificar/:path*',
    '/auditoria/:path*',
    '/documentos/:path*',
    '/asignaciones/:path*',
    '/admin/:path*',
  ],
}
