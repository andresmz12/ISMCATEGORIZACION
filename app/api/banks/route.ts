import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'
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
  const [mappings, importHistory] = await Promise.all([
    prisma.bankFormatMapping.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { businessId, action: 'IMPORT_TRANSACTIONS' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])
  return NextResponse.json({ mappings, importHistory })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const businessId = searchParams.get('businessId')
  const target = searchParams.get('target') // 'history' | 'mappings' | 'all'

  // Bulk delete
  if (!id && businessId) {
    if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (target === 'history') {
      const { count } = await prisma.auditLog.deleteMany({ where: { businessId, action: 'IMPORT_TRANSACTIONS' } })
      return NextResponse.json({ deleted: count })
    }
    if (target === 'mappings') {
      const { count } = await prisma.bankFormatMapping.deleteMany({ where: { businessId } })
      return NextResponse.json({ deleted: count })
    }
    return NextResponse.json({ error: 'target required (history|mappings)' }, { status: 400 })
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const mapping = await prisma.bankFormatMapping.findUnique({ where: { id } })
  if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessWriteAccess(userId, mapping.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.bankFormatMapping.delete({ where: { id } })
  await logAudit({ userId, businessId: mapping.businessId, action: 'DELETE_BANK_MAPPING', entity: 'BankFormatMapping', entityId: id })
  return NextResponse.json({ ok: true })
}
