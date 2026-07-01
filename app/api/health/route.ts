import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: { database: 'ok' | 'error'; calculations: 'ok' | 'error' } = {
    database: 'ok',
    calculations: 'ok',
  }

  const metrics = {
    activeUsers: 0,
    portfolios: 0,
    lastCalculation: null as string | null,
  }

  try {
    const [activeUsers, portfolios] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.business.count(),
    ])
    metrics.activeUsers = activeUsers
    metrics.portfolios = portfolios
  } catch {
    checks.database = 'error'
  }

  try {
    const lastTx = await prisma.transaction.findFirst({
      where: { status: 'CLASSIFIED' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    })
    metrics.lastCalculation = lastTx?.updatedAt?.toISOString() ?? null
  } catch {
    checks.calculations = 'error'
  }

  const status = checks.database === 'ok' && checks.calculations === 'ok' ? 'ok' : 'error'

  return NextResponse.json({
    status,
    app: 'My Profit',
    version: '1.0',
    timestamp: new Date().toISOString(),
    checks,
    metrics,
  })
}
