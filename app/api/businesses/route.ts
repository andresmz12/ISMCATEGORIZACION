import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  if (accountType === 'SUPERADMIN') {
    const businesses = await prisma.business.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(businesses)
  }

  const businessUsers = await prisma.businessUser.findMany({
    where: { userId },
    include: { business: true },
  })
  return NextResponse.json(businessUsers.map(bu => ({ ...bu.business, userRole: bu.role })))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { name, industry, entityType, taxYear } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  if (accountType === 'INDIVIDUAL') {
    const existing = await prisma.businessUser.count({ where: { userId } })
    if (existing >= 1) return NextResponse.json({ error: 'El plan Independiente solo permite un negocio' }, { status: 403 })
  }

  const business = await prisma.business.create({
    data: { name, industry, entityType, taxYear: taxYear ? Number(taxYear) : null },
  })
  await prisma.businessUser.create({ data: { userId, businessId: business.id, role: 'OWNER' } })

  // Grant access to all team members of this owner
  const teamMembers = await prisma.user.findMany({ where: { teamOwnerId: userId }, select: { id: true } })
  if (teamMembers.length > 0) {
    await prisma.businessUser.createMany({
      data: teamMembers.map(m => ({ userId: m.id, businessId: business.id, role: 'VIEWER' as const })),
      skipDuplicates: true,
    })
  }

  await logAudit({ userId, businessId: business.id, action: 'CREATE_BUSINESS', entity: 'Business', entityId: business.id, metadata: { name } })
  return NextResponse.json(business, { status: 201 })
}
