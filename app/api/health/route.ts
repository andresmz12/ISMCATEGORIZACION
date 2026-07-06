import { NextResponse } from 'next/server'
import os from 'node:os'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DB_PING_TIMEOUT_MS = 1500

// CPU % of THIS process, averaged over the interval between health checks.
// Baseline starts at module load, so the first call measures since boot.
let lastCpu = process.cpuUsage()
let lastAt = Date.now()

function cpuPercent(): number {
  const now = Date.now()
  const cur = process.cpuUsage()
  const usedMs = (cur.user - lastCpu.user + (cur.system - lastCpu.system)) / 1000
  const elapsedMs = now - lastAt
  lastCpu = cur
  lastAt = now
  if (elapsedMs <= 0) return 0
  const cores = os.cpus().length || 1
  return Math.min(100, Math.max(0, Math.round((usedMs / (elapsedMs * cores)) * 1000) / 10))
}

// Process RSS as % of the container memory limit. Railway doesn't expose the
// container limit to Node, so set MEMORY_LIMIT_MB to the plan's limit for an
// exact figure; without it, fall back to the host's total memory.
function memoryPercent(): number {
  const rss = process.memoryUsage().rss
  const limitMb =
    Number(process.env.MEMORY_LIMIT_MB) || Number(process.env.HEALTH_MEMORY_LIMIT_MB)
  const total = limitMb > 0 ? limitMb * 1024 * 1024 : os.totalmem()
  return Math.min(100, Math.max(0, Math.round((rss / total) * 1000) / 10))
}

async function pingDatabase(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB ping timeout')), DB_PING_TIMEOUT_MS)
      ),
    ])
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const databaseConnected = await pingDatabase()
  const memoryUsage = memoryPercent()
  const cpuUsage = cpuPercent()

  const status = !databaseConnected
    ? 'error'
    : memoryUsage > 90 || cpuUsage > 90
      ? 'degraded'
      : 'ok'

  // errorRate is intentionally omitted: this app doesn't track 5xx responses,
  // and reporting a made-up number would be worse than reporting nothing.
  return NextResponse.json(
    {
      status,
      databaseConnected,
      memoryUsage,
      cpuUsage,
      uptimeSeconds: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    },
    { status: status === 'error' ? 503 : 200 }
  )
}
