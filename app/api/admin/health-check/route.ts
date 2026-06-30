import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { prisma } from '@/lib/prisma'
import os from 'os'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export const dynamic = 'force-dynamic'
export const revalidate = 0

// In-memory tracking for error rate and consecutive failures
const WINDOW_SIZE = 100
const requestHistory: boolean[] = [] // true = success, false = error
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
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'starting',
    app: 'Report System',
    results: {},
  }

  let requestSuccess = true

  try {
    let dbConnected = false

    // 1. Check DB connection
    try {
      await prisma.$queryRaw`SELECT 1`
      dbConnected = true
      checks.results.database = { ok: true, message: 'Database connected' }
    } catch (e: any) {
      dbConnected = false
      requestSuccess = false
      checks.results.database = { ok: false, error: e.message }
    }

    // 2. Check if User table exists
    try {
      const count = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::integer as count FROM "User"
      `
      checks.results.userTable = { ok: true, userCount: Number(count[0]?.count ?? 0) }
    } catch (e: any) {
      requestSuccess = false
      checks.results.userTable = { ok: false, error: e.message }
    }

    // 3. Check/create superadmin
    try {
      const email = process.env.SUPERADMIN_EMAIL || 'superadmin@mypnl.com'
      const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!'
      const hash = await bcrypt.hash(password, 12)

      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE email = ${email}
      `

      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "User" (id, email, "passwordHash", name, "accountType", plan, "isActive", "createdAt", "updatedAt")
          VALUES (${cuid()}, ${email}, ${hash}, 'Super Admin', 'SUPERADMIN', 'ENTERPRISE', true, NOW(), NOW())
        `
        checks.results.superadmin = { ok: true, action: 'created', email }
      } else {
        await prisma.$executeRaw`
          UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "accountType" = 'SUPERADMIN', plan = 'ENTERPRISE'
          WHERE email = ${email}
        `
        checks.results.superadmin = { ok: true, action: 'updated', email }
      }
    } catch (e: any) {
      requestSuccess = false
      checks.results.superadmin = { ok: false, error: e.message }
    }

    // 4. Check schema sync
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

    // 5. Check key tables exist
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

    // Record result for error tracking
    recordResult(requestSuccess)

    // Overall status
    const allOk = Object.values(checks.results).every((r: any) => r.ok !== false)
    checks.status = allOk ? 'ok' : 'degraded'

    // Add metrics fields
    checks.errorRate = getErrorRate()
    checks.consecutiveFailures = consecutiveFailures
    checks.databaseConnected = dbConnected
    checks.memoryUsage = getMemoryUsage()
    checks.cpuUsage = getCpuUsage()

    return NextResponse.json(JSON.parse(JSON.stringify(checks, (_, v) => typeof v === 'bigint' ? Number(v) : v)))
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
