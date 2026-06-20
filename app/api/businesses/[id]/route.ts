import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function checkOwner(userId: string, businessId: string) {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
  return bu?.role === 'OWNER'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  if (!await checkOwner(userId, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  if (!await checkOwner(userId, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.business.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
