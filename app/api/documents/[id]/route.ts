import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { deleteFile } from '@/lib/storage'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: doc.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ url: doc.url, mimeType: doc.mimeType, filename: doc.filename })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: doc.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await deleteFile(doc.url)
  await prisma.document.delete({ where: { id: params.id } })
  await logAudit({ userId, businessId: doc.businessId, action: 'DELETE_DOCUMENT', entity: 'Document', entityId: params.id })
  return NextResponse.json({ ok: true })
}
