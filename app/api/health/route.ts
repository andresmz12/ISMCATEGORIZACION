import { NextResponse } from 'next/server'
import os from 'os'
import { prisma } from '@/lib/prisma'

export async function GET() {
  let databaseConnected = true
  let consecutiveFailures = 0

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    databaseConnected = false
    consecutiveFailures++
  }

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10

  const loadAvg = os.loadavg()[0]
  const numCpus = os.cpus().length
  const cpuUsage = Math.min(Math.round((loadAvg / numCpus) * 100 * 10) / 10, 100)

  const errorRate = Math.round((consecutiveFailures / 1) * 100 * 10) / 10
  const status = databaseConnected ? 'ok' : 'error'

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
