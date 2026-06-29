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
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
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
  const accountType = (session.user as any).accountType
  const { businessId, pattern, categoryId, priority, field, deductibility } = await req.json()
  if (!businessId || !pattern || !categoryId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  if (typeof pattern !== 'string' || pattern.trim().length === 0 || pattern.length > 500) {
    return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 })
  }
  try { new RegExp(pattern.trim()) } catch {
    return NextResponse.json({ error: 'Pattern is not a valid regular expression' }, { status: 400 })
  }
  const VALID_DEDUCTIBILITY = ['YES', 'NO', 'FIFTY']
  if (deductibility && !VALID_DEDUCTIBILITY.includes(deductibility)) {
    return NextResponse.json({ error: 'Invalid deductibility value' }, { status: 400 })
  }
  const VALID_FIELDS = ['description', 'amount']
  const safeField = VALID_FIELDS.includes(field) ? field : 'description'
  const safePriority = typeof priority === 'number' && isFinite(priority) ? Math.round(priority) : 0
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rule = await prisma.classificationRule.create({
    data: { businessId, pattern: pattern.trim(), categoryId, priority: safePriority, field: safeField, deductibility: deductibility || null },
    include: { category: true },
  })
  await logAudit({ userId, businessId, action: 'CREATE_RULE', entity: 'ClassificationRule', entityId: rule.id, metadata: { pattern, categoryId } })
  return NextResponse.json(rule, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const rule = await prisma.classificationRule.findUnique({ where: { id } })
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessAccess(userId, rule.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.classificationRule.delete({ where: { id } })
  await logAudit({ userId, businessId: rule.businessId, action: 'DELETE_RULE', entity: 'ClassificationRule', entityId: id })
  return NextResponse.json({ deleted: id })
}
