import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { rateLimit } from './rate-limit'

// How often a live session's JWT re-checks the DB for accountType/plan/
// isActive changes, instead of trusting what was true at login for the
// entire 8-hour session lifetime. Without this, deactivating a user,
// demoting a SUPERADMIN, or downgrading a delinquent account's plan has no
// effect on their already-issued session until it naturally expires —
// middleware and requirePlanFeature() both read straight from the token.
const REVALIDATE_INTERVAL_MS = 60 * 1000

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8-hour sessions
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accountType = (user as any).accountType
        token.accountId = (user as any).accountId
        token.accountRole = (user as any).accountRole
        token.plan = (user as any).plan
        token.chatbotEnabled = (user as any).chatbotEnabled
        token.trialEndsAt = (user as any).trialEndsAt
        token.isActive = true // authorize() already filtered out inactive users
        token.validatedAt = Date.now()
        return token
      }

      const validatedAt = (token.validatedAt as number | undefined) ?? 0
      if (Date.now() - validatedAt < REVALIDATE_INTERVAL_MS) return token

      const dbUser = token.id
        ? await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              isActive: true, accountType: true, accountRole: true,
              billingAccount: { select: { plan: true, chatbotEnabled: true, trialEndsAt: true } },
            },
          })
        : null

      if (!dbUser || !dbUser.isActive) {
        token.isActive = false
      } else {
        token.accountType = dbUser.accountType
        token.accountRole = dbUser.accountRole
        token.plan = dbUser.billingAccount.plan
        token.chatbotEnabled = dbUser.billingAccount.chatbotEnabled
        token.trialEndsAt = dbUser.billingAccount.trialEndsAt
        token.isActive = true
      }
      token.validatedAt = Date.now()
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).accountType = token.accountType
        ;(session.user as any).accountId = token.accountId
        ;(session.user as any).accountRole = token.accountRole
        ;(session.user as any).plan = token.plan
        ;(session.user as any).chatbotEnabled = token.chatbotEnabled
        ;(session.user as any).trialEndsAt = token.trialEndsAt
        ;(session.user as any).isActive = token.isActive !== false
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

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true, email: true, passwordHash: true, name: true, accountType: true, isActive: true,
              accountId: true, accountRole: true,
              billingAccount: { select: { plan: true, chatbotEnabled: true, trialEndsAt: true } },
            },
          })
          if (!user || !user.isActive) return null
          const valid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!valid) return null

          prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {})
          return {
            id: user.id, email: user.email, name: user.name, accountType: user.accountType,
            accountId: user.accountId, accountRole: user.accountRole, plan: user.billingAccount.plan,
            chatbotEnabled: user.billingAccount.chatbotEnabled, trialEndsAt: user.billingAccount.trialEndsAt,
          }
        } catch (err) {
          console.error('authorize error:', err)
          return null
        }
      },
    }),
  ],
}
