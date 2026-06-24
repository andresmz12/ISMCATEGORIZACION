import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { customAlphabet } from 'nanoid'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export async function POST(req: NextRequest) {
  const db = new PrismaClient()
  try {
    const password = 'SuperAdmin123!'
    const email = 'superadmin@mypnl.com'
    const hash = await bcrypt.hash(password, 12)

    // Use raw SQL to avoid schema validation
    const existing = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${email}
    `

    if (existing.length === 0) {
      await db.$executeRaw`
        INSERT INTO "User" (id, email, "passwordHash", name, "accountType", plan, "isActive", "createdAt", "updatedAt")
        VALUES (${cuid()}, ${email}, ${hash}, 'Super Admin', 'SUPERADMIN', 'ENTERPRISE', true, NOW(), NOW())
      `
    } else {
      await db.$executeRaw`
        UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "accountType" = 'SUPERADMIN', plan = 'ENTERPRISE', "updatedAt" = NOW()
        WHERE email = ${email}
      `
    }

    return NextResponse.json({
      success: true,
      message: 'Superadmin created/updated',
      email,
      password,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  } finally {
    await db.$disconnect()
  }
}
