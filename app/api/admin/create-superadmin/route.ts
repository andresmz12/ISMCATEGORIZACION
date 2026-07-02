import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!'
    const email = process.env.SUPERADMIN_EMAIL || 'superadmin@mypnl.com'
    const hash = await bcrypt.hash(password, 12)

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${email}
    `

    if (existing.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, "passwordHash", name, "accountType", plan, "isActive", "createdAt", "updatedAt")
        VALUES (${cuid()}, ${email}, ${hash}, 'Super Admin', 'SUPERADMIN', 'ENTERPRISE', true, NOW(), NOW())
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "accountType" = 'SUPERADMIN', plan = 'ENTERPRISE', "updatedAt" = NOW()
        WHERE email = ${email}
      `
    }

    return NextResponse.json({ success: true, message: 'Superadmin created/updated', email })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
