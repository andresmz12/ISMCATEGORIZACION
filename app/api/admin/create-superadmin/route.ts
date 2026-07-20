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
    const password = process.env.SUPERADMIN_PASSWORD
    const email = process.env.SUPERADMIN_EMAIL
    if (!password || !email) {
      return NextResponse.json(
        { success: false, error: 'SUPERADMIN_PASSWORD and SUPERADMIN_EMAIL must be set — no default credentials are used' },
        { status: 503 }
      )
    }
    const hash = await bcrypt.hash(password, 12)

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${email}
    `

    if (existing.length === 0) {
      const accountId = cuid()
      await prisma.$transaction([
        prisma.$executeRaw`
          INSERT INTO "BillingAccount" (id, plan, "updatedAt")
          VALUES (${accountId}, 'ENTERPRISE', NOW())
        `,
        prisma.$executeRaw`
          INSERT INTO "User" (id, email, "passwordHash", name, "accountType", "accountId", "accountRole", "isActive", "createdAt", "updatedAt")
          VALUES (${cuid()}, ${email}, ${hash}, 'Super Admin', 'SUPERADMIN', ${accountId}, 'OWNER', true, NOW(), NOW())
        `,
      ])
    } else {
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "accountType" = 'SUPERADMIN', "updatedAt" = NOW()
          WHERE email = ${email}
        `,
        prisma.$executeRaw`
          UPDATE "BillingAccount" SET plan = 'ENTERPRISE'
          WHERE id = (SELECT "accountId" FROM "User" WHERE email = ${email})
        `,
      ])
    }

    return NextResponse.json({ success: true, message: 'Superadmin created/updated', email })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
