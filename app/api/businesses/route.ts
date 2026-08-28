import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { customAlphabet } from 'nanoid'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { getPlanLimits, countOwnedBusinesses } from '@/lib/plan-limits'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

class BusinessLimitError extends Error {}

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
  const accountId = (session.user as any).accountId
  const plan = (session.user as any).plan
  const trialEndsAt = (session.user as any).trialEndsAt

  const rl = rateLimit(`business-create:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  try {
    const { name, industry, entityType, taxYear, currency } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const businessCurrency = currency === 'COP' ? 'COP' : 'USD'

    if (accountType === 'TEAM_MEMBER') {
      return NextResponse.json({ error: 'Los miembros del equipo no pueden crear negocios' }, { status: 403 })
    }

    const businessId = cuid()
    const now = new Date()
    try {
      await prisma.$transaction(async (tx) => {
        if (accountType === 'ACCOUNTANT') {
          // Serialize concurrent creates for the same account so two requests
          // can't both read the pre-insert count and both slip past the plan
          // limit — the lock is held for the rest of this transaction and
          // released automatically on commit/rollback.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`
          const limits = getPlanLimits(plan, trialEndsAt)
          const existingCount = await countOwnedBusinesses(accountId, tx)
          if (existingCount >= limits.businesses) {
            const planLabel = plan ?? 'BASIC'
            const cap = limits.businesses === Infinity ? 'ilimitados' : limits.businesses
            throw new BusinessLimitError(`Tu plan ${planLabel} permite hasta ${cap} negocio(s)`)
          }
        }

        await tx.$executeRaw`
          INSERT INTO "Business" (id, name, industry, "entityType", "taxYear", currency, "createdAt", "updatedAt")
          VALUES (${businessId}, ${name}, ${industry || null}, ${entityType || null}, ${taxYear ? Number(taxYear) : null}, ${businessCurrency}::"Currency", ${now}, ${now})
        `
        await tx.$executeRaw`
          INSERT INTO "BusinessUser" (id, "userId", "businessId", role, "createdAt")
          VALUES (${cuid()}, ${userId}, ${businessId}, 'OWNER', ${now})
        `
      })
    } catch (e) {
      if (e instanceof BusinessLimitError) {
        return NextResponse.json({ error: e.message }, { status: 403 })
      }
      throw e
    }

    // Team features disabled for now

    await logAudit({ userId, businessId, action: 'CREATE_BUSINESS', entity: 'Business', entityId: businessId, metadata: { name } })
    return NextResponse.json({ id: businessId, name, industry, entityType, taxYear, currency: businessCurrency }, { status: 201 })
  } catch (e: any) {
    console.error('create business error:', e)
    return NextResponse.json({ error: 'Error al crear el negocio' }, { status: 500 })
  }
}
