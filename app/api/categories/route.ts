import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')

  // Always include system categories; custom categories only if caller has access
  const where: any = { OR: [{ isSystem: true }] }
  if (businessId) {
    const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
    if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  const { name, irsCode, description, businessId } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })

  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cat = await prisma.category.create({ data: { name, irsCode, description, businessId } })
  return NextResponse.json(cat, { status: 201 })
}
