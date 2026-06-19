import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
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
  const { name, industry, entityType, taxYear } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const business = await prisma.business.create({
    data: { name, industry, entityType, taxYear: taxYear ? Number(taxYear) : null },
  })
  await prisma.businessUser.create({ data: { userId, businessId: business.id, role: 'OWNER' } })
  return NextResponse.json(business, { status: 201 })
}
