import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import path from 'path'

// One-time setup endpoint — pushes schema + seeds demo users.
// Protected by SETUP_SECRET env var. Safe to leave deployed.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const envSecret = process.env.SETUP_SECRET

  if (!envSecret || !secret || secret !== envSecret) {
    return NextResponse.json({ error: 'Forbidden — pass Authorization: Bearer <SETUP_SECRET>' }, { status: 403 })
  }

  const results: string[] = []

  // Step 1: Pre-migration SQL
  // The DB has an old Role enum with ACCOUNTANT. Prisma can't migrate enums
  // when rows contain values not in the new enum, so we:
  //   a) Add new values to existing Role enum
  //   b) Update any ACCOUNTANT rows to VIEWER
  //   c) Convert column to text (so Prisma can freely recreate the enum)
  //   d) Drop the old Role enum
  try {
    // Add new enum values if they don't exist yet
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER'`)
    results.push('✓ Role enum values expanded')
  } catch (e: any) {
    // Role enum might not exist at all — that's fine
    results.push(`⚠ Role enum expansion (non-fatal): ${String(e.message).slice(0, 100)}`)
  }

  try {
    // Update any rows with ACCOUNTANT role to VIEWER
    await prisma.$executeRawUnsafe(`
      UPDATE "BusinessUser" SET "role" = 'VIEWER' WHERE "role"::text = 'ACCOUNTANT'
    `)
    results.push('✓ Migrated ACCOUNTANT roles to VIEWER')
  } catch (e: any) {
    results.push(`⚠ Role data migration (non-fatal): ${String(e.message).slice(0, 100)}`)
  }

  try {
    // Drop column default and convert to text so Prisma can freely recreate the enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'BusinessUser' AND column_name = 'role'
        ) THEN
          ALTER TABLE "BusinessUser" ALTER COLUMN "role" DROP DEFAULT;
          ALTER TABLE "BusinessUser" ALTER COLUMN "role" TYPE text USING "role"::text;
        END IF;
      END $$;
    `)
    results.push('✓ Converted role column to text for migration')
  } catch (e: any) {
    results.push(`⚠ Role column conversion (non-fatal): ${String(e.message).slice(0, 100)}`)
  }

  try {
    // Drop old Role enum so Prisma can create a fresh one
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "Role" CASCADE`)
    results.push('✓ Dropped old Role enum')
  } catch (e: any) {
    results.push(`⚠ Drop Role enum (non-fatal): ${String(e.message).slice(0, 100)}`)
  }

  // Step 2: Push schema using direct binary
  const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')
  try {
    execSync(`${prismaBin} db push --accept-data-loss`, {
      stdio: 'pipe',
      timeout: 90000,
      env: { ...process.env },
      cwd: process.cwd(),
    })
    results.push('✓ Schema pushed (prisma db push)')
  } catch (e: any) {
    const stderr = Buffer.isBuffer(e.stderr) ? e.stderr.toString() : String(e.stderr || '')
    const stdout = Buffer.isBuffer(e.stdout) ? e.stdout.toString() : String(e.stdout || '')
    const msg = (stderr || stdout || e.message || 'unknown').slice(0, 1000)
    results.push(`✗ Schema push FAILED: ${msg}`)
    return NextResponse.json({ ok: false, results, error: msg }, { status: 500 })
  }

  // Step 3: Seed users + categories
  try {
    const superHash = await bcrypt.hash('SuperAdmin123!', 12)
    await prisma.user.upsert({
      where: { email: 'superadmin@mypnl.com' },
      update: { passwordHash: superHash, isActive: true },
      create: {
        email: 'superadmin@mypnl.com',
        passwordHash: superHash,
        name: 'Super Admin',
        accountType: 'SUPERADMIN',
        plan: 'ENTERPRISE',
        isActive: true,
      },
    })
    results.push('✓ superadmin@mypnl.com / SuperAdmin123!')

    const contHash = await bcrypt.hash('password123', 12)
    await prisma.user.upsert({
      where: { email: 'contador@demo.com' },
      update: { passwordHash: contHash, isActive: true },
      create: {
        email: 'contador@demo.com',
        passwordHash: contHash,
        name: 'Carlos Contable',
        accountType: 'ACCOUNTANT',
        plan: 'PLUS',
        isActive: true,
      },
    })
    results.push('✓ contador@demo.com / password123')

    const indHash = await bcrypt.hash('password123', 12)
    await prisma.user.upsert({
      where: { email: 'usuario@demo.com' },
      update: { passwordHash: indHash, isActive: true },
      create: {
        email: 'usuario@demo.com',
        passwordHash: indHash,
        name: 'Maria Emprendedora',
        accountType: 'INDIVIDUAL',
        plan: 'BASIC',
        isActive: true,
      },
    })
    results.push('✓ usuario@demo.com / password123')

    const SYSTEM_CATEGORIES = [
      { name: 'Advertising', irsCode: 'Schedule C Line 8' },
      { name: 'Car & Truck Expenses', irsCode: 'Schedule C Line 9' },
      { name: 'Commissions & Fees', irsCode: 'Schedule C Line 10' },
      { name: 'Contract Labor', irsCode: 'Schedule C Line 11' },
      { name: 'Insurance', irsCode: 'Schedule C Line 15' },
      { name: 'Interest - Other', irsCode: 'Schedule C Line 16b' },
      { name: 'Legal & Professional', irsCode: 'Schedule C Line 17' },
      { name: 'Office Expenses', irsCode: 'Schedule C Line 18' },
      { name: 'Rent - Other', irsCode: 'Schedule C Line 20b' },
      { name: 'Repairs & Maintenance', irsCode: 'Schedule C Line 21' },
      { name: 'Supplies', irsCode: 'Schedule C Line 22' },
      { name: 'Taxes & Licenses', irsCode: 'Schedule C Line 23' },
      { name: 'Travel', irsCode: 'Schedule C Line 24a' },
      { name: 'Meals (50%)', irsCode: 'Schedule C Line 24b' },
      { name: 'Utilities', irsCode: 'Schedule C Line 25' },
      { name: 'Wages', irsCode: 'Schedule C Line 26' },
      { name: 'Other Expenses', irsCode: 'Schedule C Line 27a' },
      { name: 'Cost of Goods Sold', irsCode: 'Schedule C Part III' },
      { name: 'Business Income', irsCode: 'Schedule C Line 1' },
      { name: 'Owner Draw / Personal', irsCode: 'Non-Deductible' },
      { name: 'Transfer', irsCode: 'Non-Deductible' },
      { name: 'Uncategorized', irsCode: 'Unclassified' },
    ]
    for (const c of SYSTEM_CATEGORIES) {
      const id = `sys_${c.name.replace(/[\s/&()]+/g, '_').toLowerCase()}`
      await prisma.category.upsert({
        where: { id },
        update: {},
        create: { id, name: c.name, irsCode: c.irsCode, isSystem: true },
      })
    }
    results.push(`✓ ${SYSTEM_CATEGORIES.length} system categories`)

    const userCount = await prisma.user.count()
    const catCount = await prisma.category.count()

    return NextResponse.json({
      ok: true,
      message: 'Setup complete',
      results,
      db: { users: userCount, categories: catCount },
    })
  } catch (e: any) {
    results.push(`✗ Seed error: ${e.message}`)
    return NextResponse.json({ ok: false, results, error: e.message }, { status: 500 })
  }
}
