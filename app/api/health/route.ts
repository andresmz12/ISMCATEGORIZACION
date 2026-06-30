import { NextResponse } from 'next/server'
import os from 'os'
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

  let failedChecks = 0

  try {
    const [activeUsers, portfolios] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.business.count(),
    ])
    metrics.activeUsers = activeUsers
    metrics.portfolios = portfolios
  } catch {
    checks.database = 'error'
    failedChecks++
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
    failedChecks++
  }

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10

  const loadAvg = os.loadavg()[0]
  const numCpus = os.cpus().length
  const cpuUsage = Math.min(Math.round((loadAvg / numCpus) * 100 * 10) / 10, 100)

  const errorRate = Math.round((failedChecks / 2) * 100 * 10) / 10
  const status = checks.database === 'ok' && checks.calculations === 'ok' ? 'ok' : 'error'

  return NextResponse.json({
    status,
    app: 'My Profit',
    version: '1.0',
    errorRate,
    consecutiveFailures: failedChecks,
    databaseConnected: checks.database === 'ok',
    memoryUsage,
    cpuUsage,
    timestamp: new Date().toISOString(),
    checks,
    metrics,
  })
}
