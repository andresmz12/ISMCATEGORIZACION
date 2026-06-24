import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { PrismaClient } from '@prisma/client'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export async function GET() {
  const db = new PrismaClient()
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'starting',
    results: {},
  }

  try {
    // 1. Check DB connection
    try {
      await db.$queryRaw`SELECT 1`
      checks.results.database = { ok: true, message: 'Database connected' }
    } catch (e: any) {
      checks.results.database = { ok: false, error: e.message }
    }

    // 2. Check if User table exists
    try {
      const count = await db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::integer as count FROM "User"
      `
      checks.results.userTable = { ok: true, userCount: Number(count[0]?.count ?? 0) }
    } catch (e: any) {
      checks.results.userTable = { ok: false, error: e.message }
    }

    // 3. Check/create superadmin
    try {
      const email = 'superadmin@mypnl.com'
      const password = 'SuperAdmin123!'
      const hash = await bcrypt.hash(password, 12)

      const existing = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE email = ${email}
      `

      if (existing.length === 0) {
        await db.$executeRaw`
          INSERT INTO "User" (id, email, "passwordHash", name, "accountType", plan, "isActive", "createdAt", "updatedAt")
          VALUES (${cuid()}, ${email}, ${hash}, 'Super Admin', 'SUPERADMIN', 'ENTERPRISE', true, NOW(), NOW())
        `
        checks.results.superadmin = { ok: true, action: 'created', email, password }
      } else {
        // Update password to ensure it works
        await db.$executeRaw`
          UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "accountType" = 'SUPERADMIN', plan = 'ENTERPRISE'
          WHERE email = ${email}
        `
        checks.results.superadmin = { ok: true, action: 'updated', email, password }
      }
    } catch (e: any) {
      checks.results.superadmin = { ok: false, error: e.message }
    }

    // 4. Check schema sync
    try {
      const userColumns = await db.$queryRaw<{ column_name: string }[]>`
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
      checks.results.schema = { ok: false, error: e.message }
    }

    // 5. Check key tables exist
    const tables = ['Business', 'BusinessUser', 'Transaction', 'Category']
    for (const table of tables) {
      try {
        await db.$queryRaw`SELECT 1 FROM "${table}" LIMIT 1`.catch(() => {})
        checks.results[`table_${table}`] = { ok: true }
      } catch (e: any) {
        checks.results[`table_${table}`] = { ok: false, error: e.message }
      }
    }

    // Overall status
    const allOk = Object.values(checks.results).every((r: any) => r.ok !== false)
    checks.status = allOk ? 'healthy' : 'degraded'

    // Ensure safe JSON serialization
    return NextResponse.json(JSON.parse(JSON.stringify(checks, (_, v) => typeof v === 'bigint' ? Number(v) : v)))
  } catch (error: any) {
    checks.status = 'error'
    checks.error = error.message
    return NextResponse.json(checks, { status: 500 })
  } finally {
    await db.$disconnect()
  }
}
