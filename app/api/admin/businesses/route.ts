import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        include: { user: { select: { id: true, name: true, email: true, accountType: true, plan: true } } },
      },
      _count: { select: { transactions: true } },
      aiUsage: { where: { period: currentPeriod() } },
    },
  })
  return NextResponse.json(businesses)
}
