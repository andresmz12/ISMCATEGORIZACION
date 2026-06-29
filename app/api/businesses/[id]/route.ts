import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

async function checkOwner(userId: string, businessId: string, accountType?: string) {
  if (accountType === 'SUPERADMIN') return true
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
  return bu?.role === 'OWNER'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  if (!await checkOwner(userId, params.id, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, industry, entityType, taxYear } = await req.json()
  const updated = await prisma.business.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(industry !== undefined && { industry }),
      ...(entityType !== undefined && { entityType }),
      ...(taxYear !== undefined && { taxYear: taxYear ? Number(taxYear) : null }),
    },
  })
  await logAudit({ userId, businessId: params.id, action: 'UPDATE_BUSINESS', entity: 'Business', entityId: params.id, metadata: { name: updated.name } })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  if (!await checkOwner(userId, params.id, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await logAudit({ userId, businessId: params.id, action: 'DELETE_BUSINESS', entity: 'Business', entityId: params.id })
  await prisma.business.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
