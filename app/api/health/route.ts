import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import os from 'os'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 5 * 60 * 1000

interface RequestRecord {
  timestamp: number
  failed: boolean
}

const requestHistory: RequestRecord[] = []
let lastCpuSnapshot = process.cpuUsage()
let lastCpuTime = Date.now()

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

  // memoryUsage: process RSS as % of total system RAM (0–100)
  let memoryUsage: number | null = null
  try {
    const totalMem = os.totalmem()
    if (totalMem > 0) {
      const rss = process.memoryUsage().rss
      memoryUsage = Math.round((rss / totalMem) * 1000) / 10
    }
  } catch {
    memoryUsage = null
  }

  // cpuUsage: CPU % consumed since the previous call (0–100)
  let cpuUsage: number | null = null
  try {
    const curr = process.cpuUsage()
    const elapsed = now - lastCpuTime
    if (elapsed > 0) {
      const userDelta = curr.user - lastCpuSnapshot.user
      const sysDelta = curr.system - lastCpuSnapshot.system
      const raw = ((userDelta + sysDelta) / 1000 / elapsed) * 100
      cpuUsage = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10
    }
    lastCpuSnapshot = curr
    lastCpuTime = now
  } catch {
    cpuUsage = null
  }

  return NextResponse.json(
    { databaseConnected, errorRate, memoryUsage, cpuUsage },
    { status: 200 }
  )
}
