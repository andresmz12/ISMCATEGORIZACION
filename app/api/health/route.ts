import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CHECK_HISTORY_SIZE = 100
const checkHistory: boolean[] = []
let consecutiveFailures = 0

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

  const databaseConnected = checks.database === 'ok'
  const status = databaseConnected && checks.calculations === 'ok' ? 'ok' : 'error'

  if (status === 'ok') {
    consecutiveFailures = 0
    checkHistory.push(true)
  } else {
    consecutiveFailures++
    checkHistory.push(false)
  }
  if (checkHistory.length > CHECK_HISTORY_SIZE) checkHistory.shift()
  const errorRate = checkHistory.length
    ? checkHistory.filter(x => !x).length / checkHistory.length
    : 0

  const mem = process.memoryUsage()
  const memoryUsage = {
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
  }

  const uptime = process.uptime()
  const cpu = process.cpuUsage()
  const totalMicros = uptime * 1_000_000
  const cpuUsage = totalMicros > 0
    ? Math.round((cpu.user + cpu.system) / totalMicros * 100 * 100) / 100
    : 0

  return NextResponse.json({
    status,
    app: 'My Profit',
    version: '1.0',
    timestamp: new Date().toISOString(),
    uptime,
    errorRate,
    consecutiveFailures,
    databaseConnected,
    memoryUsage,
    cpuUsage,
    checks,
    metrics,
  })
}
