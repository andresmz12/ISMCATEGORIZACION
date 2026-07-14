import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  if (!(await checkBusinessAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docs = await prisma.document.findMany({
    where: { businessId },
    include: {
      documentType: { select: { name: true } },
      uploadedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(docs.map(d => ({
    id: d.id,
    filename: d.filename,
    mimeType: d.mimeType,
    notes: d.notes,
    createdAt: d.createdAt,
    documentTypeId: d.documentTypeId,
    documentTypeName: d.documentType.name,
    uploadedBy: d.uploadedBy.name || d.uploadedBy.email,
  })))
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { businessId, documentTypeId, filename, data, mimeType, notes } = body

  if (!businessId || !documentTypeId || !filename || !data || !mimeType) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Validate file size (base64 is ~33% larger than binary)
  if (data.length > MAX_FILE_SIZE * 1.4) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  if (!(await checkBusinessWriteAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docType = await prisma.documentType.findFirst({ where: { id: documentTypeId, businessId } })
  if (!docType) return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })

  const doc = await prisma.document.create({
    data: { businessId, documentTypeId, filename, data, mimeType, uploadedById: userId, notes: notes?.trim() || null },
  })

  await logAudit({ userId, businessId, action: 'UPLOAD_DOCUMENT', entity: 'Document', entityId: doc.id, metadata: { filename, documentTypeId } })
  return NextResponse.json({ id: doc.id, filename: doc.filename, createdAt: doc.createdAt }, { status: 201 })
}
