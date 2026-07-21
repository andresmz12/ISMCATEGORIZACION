import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const host = req.headers.get('host') || ''
    if (host.includes('railway.app') || host.includes('up.railway.app')) {
      const url = req.nextUrl.clone()
      url.host = 'www.myprofitandloss.com'
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

    // The "no active plan" block used to live here too, but a middleware
    // redirect forces a full hard page reload even when the navigation was
    // a client-side <Link> click — every attempted navigation looked like
    // the whole app refreshing and the sidebar snapping back to the top.
    // That gate now lives in app/(dashboard)/layout.tsx as a client-side
    // router.replace, which Next.js can do as a soft transition. This is
    // safe to drop from here because it was only ever a UX nicety (redirect
    // straight to billing) — every actual paid feature already enforces its
    // own plan check server-side (requirePlanFeature, checkAiBudget, the
    // per-account business-count limit), so a blocked account browsing the
    // dashboard shell without hitting this gate can't do anything with it.

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
