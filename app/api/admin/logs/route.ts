import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [recentUsers, recentLogins, recentTx, recentAI] = await Promise.all([
    // New registrations
    prisma.user.findMany({
      where: { accountType: { not: 'SUPERADMIN' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, accountType: true, plan: true, createdAt: true },
    }),
    // Recent logins
    prisma.user.findMany({
      where: { lastLogin: { not: null }, accountType: { not: 'SUPERADMIN' } },
      orderBy: { lastLogin: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, lastLogin: true },
    }),
    // Recent transactions
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
        business: { select: { name: true } },
      },
    }),
    // Recent AI classifications
    prisma.transaction.findMany({
      where: { method: 'AI' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        description: true,
        amount: true,
        aiConfidence: true,
        updatedAt: true,
        business: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ])

  // Build unified activity feed
  const events: { ts: string; type: string; msg: string; sub: string }[] = []

  for (const u of recentUsers) {
    events.push({
      ts: u.createdAt.toISOString(),
      type: 'register',
      msg: `Nuevo usuario: ${u.name || u.email}`,
      sub: `${u.accountType} · Plan ${u.plan}`,
    })
  }
  for (const u of recentLogins) {
    if (u.lastLogin) {
      events.push({
        ts: u.lastLogin.toISOString(),
        type: 'login',
        msg: `Login: ${u.name || u.email}`,
        sub: u.email,
      })
    }
  }
  for (const tx of recentTx) {
    events.push({
      ts: tx.createdAt.toISOString(),
      type: 'transaction',
      msg: `Transacción importada: ${tx.description.slice(0, 50)}`,
      sub: `$${Math.abs(tx.amount).toFixed(2)} · ${tx.business.name}`,
    })
  }
  for (const ai of recentAI) {
    events.push({
      ts: ai.updatedAt.toISOString(),
      type: 'ai',
      msg: `IA clasificó: ${ai.description.slice(0, 40)}`,
      sub: `→ ${ai.category?.name ?? '?'} · ${ai.aiConfidence ?? '?'} · ${ai.business.name}`,
    })
  }

  events.sort((a, b) => b.ts.localeCompare(a.ts))

  return NextResponse.json({ events: events.slice(0, 60) })
}
