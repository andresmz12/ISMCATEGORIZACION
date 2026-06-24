import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { rateLimit } from './rate-limit'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8-hour sessions
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accountType = (user as any).accountType
        token.plan = (user as any).plan
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).accountType = token.accountType
        ;(session.user as any).plan = token.plan
      }
      return session
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()

        // 10 attempts per email per 15 minutes
        const rl = rateLimit(`login:${email}`, 10, 15 * 60 * 1000)
        if (!rl.ok) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.isActive) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {})
        return { id: user.id, email: user.email, name: user.name, accountType: user.accountType, plan: user.plan }
      },
    }),
  ],
}
