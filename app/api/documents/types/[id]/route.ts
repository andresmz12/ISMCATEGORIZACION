import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docType = await prisma.documentType.findUnique({ where: { id: params.id } })
  if (!docType) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: docType.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const updated = await prisma.documentType.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() || docType.name,
      description: body.description !== undefined ? body.description?.trim() || null : docType.description,
      required: body.required !== undefined ? !!body.required : docType.required,
    },
  })

  await logAudit({ userId: userId, businessId: docType.businessId, action: 'UPDATE_DOCUMENT_TYPE', entity: 'DocumentType', entityId: params.id })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docType = await prisma.documentType.findUnique({ where: { id: params.id } })
  if (!docType) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: docType.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.documentType.delete({ where: { id: params.id } })
  await logAudit({ userId: userId, businessId: docType.businessId, action: 'DELETE_DOCUMENT_TYPE', entity: 'DocumentType', entityId: params.id })
  return NextResponse.json({ ok: true })
}
