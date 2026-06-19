import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function checkAccess(userId: string, businessId: string) {
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  return !!bu
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rules = await prisma.classificationRule.findMany({
    where: { businessId },
    include: { category: true },
    orderBy: { priority: 'desc' },
  })
  return NextResponse.json(rules)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { businessId, pattern, categoryId, priority, field, deductibility } = await req.json()
  if (!businessId || !pattern || !categoryId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  if (pattern.length > 500) return NextResponse.json({ error: 'Pattern too long' }, { status: 400 })
  if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rule = await prisma.classificationRule.create({
    data: { businessId, pattern, categoryId, priority: priority || 0, field: field || 'description', deductibility: deductibility || null },
    include: { category: true },
  })
  return NextResponse.json(rule, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const rule = await prisma.classificationRule.findUnique({ where: { id } })
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkAccess(userId, rule.businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.classificationRule.delete({ where: { id } })
  return NextResponse.json({ deleted: id })
}
