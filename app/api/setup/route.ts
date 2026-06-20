import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// One-time setup endpoint — seeds demo users.
// Protected by SETUP_SECRET env var. Safe to leave deployed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const envSecret = process.env.SETUP_SECRET

  if (!envSecret || secret !== envSecret) {
    return NextResponse.json({ error: 'Forbidden — set SETUP_SECRET env var and pass ?secret=' }, { status: 403 })
  }

  try {
    const results: string[] = []

    // Upsert superadmin
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

    // Upsert contador
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

    // Upsert individual
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

    // System categories
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
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
