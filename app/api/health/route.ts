import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import os from 'os'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 5 * 60 * 1000
const CPU_SAMPLE_MS = 100
// Container memory limit isn't reliably exposed on Railway, so use a
// configurable ceiling instead of os.totalmem() (which reports the host's RAM).
const MEMORY_LIMIT_MB = Number(process.env.HEALTH_MEMORY_LIMIT_MB) || 512

interface RequestRecord {
  timestamp: number
  failed: boolean
}

const requestHistory: RequestRecord[] = []

function systemCpuTimes() {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    for (const type of Object.values(cpu.times)) total += type
    idle += cpu.times.idle
  }
  return { idle, total }
}

// System-wide CPU %, sampled over a short window at request time rather than
// averaged across the (long, mostly idle) interval between health checks.
async function sampleCpuUsage(sampleMs: number): Promise<number> {
  const start = systemCpuTimes()
  await new Promise(resolve => setTimeout(resolve, sampleMs))
  const end = systemCpuTimes()
  const idleDelta = end.idle - start.idle
  const totalDelta = end.total - start.total
  if (totalDelta <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, 100 - (100 * idleDelta) / totalDelta)) * 10) / 10
}

export async function GET() {
  const now = Date.now()

  // Prune records outside the 5-minute window
  const cutoff = now - WINDOW_MS
  while (requestHistory.length > 0 && requestHistory[0].timestamp < cutoff) {
    requestHistory.shift()
  }

  // Database check
  let databaseConnected: boolean
  try {
    await prisma.$queryRaw`SELECT 1`
    databaseConnected = true
  } catch {
    databaseConnected = false
  }

  // Record this request: a failed health check = DB unreachable
  requestHistory.push({ timestamp: now, failed: !databaseConnected })

  // errorRate: % of requests that failed in the last 5 minutes (0–100)
  let errorRate: number | null = 0
  if (requestHistory.length > 0) {
    const failed = requestHistory.filter(r => r.failed).length
    errorRate = Math.round((failed / requestHistory.length) * 1000) / 10
  }

  // memoryUsage: process RSS as % of a configured container memory limit (0–100)
  let memoryUsage: number | null = null
  try {
    const rssMb = process.memoryUsage().rss / 1024 / 1024
    memoryUsage = Math.round(Math.min(100, (rssMb / MEMORY_LIMIT_MB) * 100) * 10) / 10
  } catch {
    memoryUsage = null
  }

  // cpuUsage: system CPU % sampled over a short window at request time (0–100)
  let cpuUsage: number | null = null
  try {
    cpuUsage = await sampleCpuUsage(CPU_SAMPLE_MS)
  } catch {
    cpuUsage = null
  }

  return NextResponse.json(
    { databaseConnected, errorRate, memoryUsage, cpuUsage },
    { status: 200 }
  )
}
