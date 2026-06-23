import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith('/admin')) {
      if ((token as any)?.accountType !== 'SUPERADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
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
    '/admin/:path*',
  ],
}
