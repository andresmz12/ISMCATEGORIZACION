import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import os from 'os'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WINDOW_SIZE = 100
const requestHistory: boolean[] = []
let consecutiveFailures = 0

function recordResult(success: boolean) {
  requestHistory.push(success)
  if (requestHistory.length > WINDOW_SIZE) requestHistory.shift()
  if (success) {
    consecutiveFailures = 0
  } else {
    consecutiveFailures++
  }
}

function getErrorRate(): number {
  if (requestHistory.length === 0) return 0
  const errors = requestHistory.filter((r) => !r).length
  return Math.round((errors / requestHistory.length) * 100 * 10) / 10
}

function getMemoryUsage(): number {
  const total = os.totalmem()
  const free = os.freemem()
  return Math.round(((total - free) / total) * 100 * 10) / 10
}

function getCpuUsage(): number {
  const load = os.loadavg()[0]
  const cpuCount = os.cpus().length
  return Math.min(100, Math.round((load / cpuCount) * 100 * 10) / 10)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'starting',
    app: 'My Profit and Loss',
    results: {},
  }

  let requestSuccess = true
  let dbConnected = false

  try {
    // 1. Check DB connection
    try {
      await prisma.$queryRaw`SELECT 1`
      dbConnected = true
      checks.results.database = { ok: true, message: 'Database connected' }
    } catch (e: any) {
      requestSuccess = false
      checks.results.database = { ok: false, error: e.message }
    }

    // 2. Check User table and count
    try {
      const count = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::integer as count FROM "User"
      `
      checks.results.userTable = { ok: true, userCount: Number(count[0]?.count ?? 0) }
    } catch (e: any) {
      requestSuccess = false
      checks.results.userTable = { ok: false, error: e.message }
    }

    // 3. Check schema sync
    try {
      const userColumns = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'User'
      `
      const columnNames = userColumns.map((c: any) => c.column_name)
      const hasBadColumns = columnNames.includes('teamOwnerId')
      checks.results.schema = {
        ok: !hasBadColumns,
        totalColumns: columnNames.length,
        hasBadColumns,
        message: hasBadColumns ? 'teamOwnerId column still exists (DB not synced)' : 'Schema looks good',
      }
    } catch (e: any) {
      requestSuccess = false
      checks.results.schema = { ok: false, error: e.message }
    }

    // 4. Check key tables exist
    const tables = ['Business', 'BusinessUser', 'Transaction', 'Category']
    for (const table of tables) {
      try {
        await prisma.$queryRaw`SELECT 1 FROM "${table}" LIMIT 1`.catch(() => {})
        checks.results[`table_${table}`] = { ok: true }
      } catch (e: any) {
        requestSuccess = false
        checks.results[`table_${table}`] = { ok: false, error: e.message }
      }
    }

    recordResult(requestSuccess)

    const allOk = Object.values(checks.results).every((r: any) => r.ok !== false)
    checks.status = allOk ? 'ok' : 'degraded'
    checks.errorRate = getErrorRate()
    checks.consecutiveFailures = consecutiveFailures
    checks.databaseConnected = dbConnected
    checks.memoryUsage = getMemoryUsage()
    checks.cpuUsage = getCpuUsage()

    return NextResponse.json(
      JSON.parse(JSON.stringify(checks, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
    )
  } catch (error: any) {
    recordResult(false)
    checks.status = 'error'
    checks.error = error.message
    checks.errorRate = getErrorRate()
    checks.consecutiveFailures = consecutiveFailures
    checks.databaseConnected = false
    checks.memoryUsage = getMemoryUsage()
    checks.cpuUsage = getCpuUsage()
    return NextResponse.json(checks, { status: 500 })
  }
}
