import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { customAlphabet } from 'nanoid'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { getPlanLimits } from '@/lib/plan-limits'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  try {
    if (accountType === 'SUPERADMIN') {
      const businesses = await prisma.$queryRaw<any[]>`
        SELECT * FROM "Business" ORDER BY name ASC
      `
      return NextResponse.json(businesses)
    }

    const businessUsers = await prisma.$queryRaw<any[]>`
      SELECT b.*, bu.role as "userRole"
      FROM "Business" b
      INNER JOIN "BusinessUser" bu ON b.id = bu."businessId"
      WHERE bu."userId" = ${userId}
      ORDER BY b.name ASC
    `
    return NextResponse.json(businessUsers)
  } catch (error: any) {
    console.error('GET /api/businesses error:', error)
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const plan = (session.user as any).plan

  try {
    const { name, industry, entityType, taxYear } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    if (accountType !== 'SUPERADMIN') {
      const limits = getPlanLimits(plan)
      const existing = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::integer as count FROM "BusinessUser" WHERE "userId" = ${userId}
      `
      if (existing[0].count >= limits.businesses) {
        return NextResponse.json({
          error: `Tu plan ${plan} permite hasta ${limits.businesses === Infinity ? 'ilimitados' : limits.businesses} negocio(s)`,
        }, { status: 403 })
      }
    }

    const businessId = cuid()
    const now = new Date()
    await prisma.$executeRaw`
      INSERT INTO "Business" (id, name, industry, "entityType", "taxYear", "createdAt", "updatedAt")
      VALUES (${businessId}, ${name}, ${industry || null}, ${entityType || null}, ${taxYear ? Number(taxYear) : null}, ${now}, ${now})
    `
    await prisma.$executeRaw`
      INSERT INTO "BusinessUser" (id, "userId", "businessId", role, "createdAt")
      VALUES (${cuid()}, ${userId}, ${businessId}, 'OWNER', ${now})
    `

    // Team features disabled for now

    await logAudit({ userId, businessId, action: 'CREATE_BUSINESS', entity: 'Business', entityId: businessId, metadata: { name } })
    return NextResponse.json({ id: businessId, name, industry, entityType, taxYear }, { status: 201 })
  } catch (e: any) {
    console.error('create business error:', e)
    return NextResponse.json({ error: 'Error al crear el negocio' }, { status: 500 })
  }
}
