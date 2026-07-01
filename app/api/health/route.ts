import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CHECK_HISTORY_SIZE = 100
const checkHistory: boolean[] = []
let consecutiveFailures = 0

export async function GET() {
  let databaseConnected = true
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    databaseConnected = false
  }

  const status = databaseConnected ? 'ok' : 'error'

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
    errorRate,
    consecutiveFailures,
    databaseConnected,
    memoryUsage,
    cpuUsage,
    timestamp: new Date().toISOString(),
  })
}
