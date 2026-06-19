import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
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
  const { businessId, pattern, categoryId, priority, field, deductibility } = await req.json()
  if (!businessId || !pattern || !categoryId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const rule = await prisma.classificationRule.create({
    data: { businessId, pattern, categoryId, priority: priority || 0, field: field || 'description', deductibility: deductibility || null },
    include: { category: true },
  })
  return NextResponse.json(rule, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.classificationRule.delete({ where: { id } })
  return NextResponse.json({ deleted: id })
}
