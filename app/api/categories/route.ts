import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')

  const where: any = { OR: [{ isSystem: true }] }
  if (businessId) {
    if (!await checkBusinessAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.OR.push({ businessId })
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { name, irsCode, description, businessId } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })

  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cat = await prisma.category.create({ data: { name, irsCode, description, businessId } })
  await logAudit({ userId, businessId, action: 'CREATE_CATEGORY', entity: 'Category', entityId: cat.id, metadata: { name } })
  return NextResponse.json(cat, { status: 201 })
}
