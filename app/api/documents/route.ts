import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { uploadFile } from '@/lib/storage'

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
    url: d.url,
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

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const formData = await req.formData()
  const businessId = formData.get('businessId') as string
  const documentTypeId = formData.get('documentTypeId') as string
  const notes = formData.get('notes') as string | null
  const file = formData.get('file') as File

  if (!businessId || !documentTypeId || !file) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (!(await checkBusinessAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docType = await prisma.documentType.findFirst({ where: { id: documentTypeId, businessId } })
  if (!docType) return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })
  }

  const key = `documents/${businessId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const url = await uploadFile(key, buffer, file.type || 'application/octet-stream')

  const doc = await prisma.document.create({
    data: { businessId, documentTypeId, filename: file.name, url, mimeType: file.type || 'application/octet-stream', uploadedById: userId, notes: notes?.trim() || null },
  })

  await logAudit({ userId, businessId, action: 'UPLOAD_DOCUMENT', entity: 'Document', entityId: doc.id, metadata: { filename: file.name, documentTypeId } })
  return NextResponse.json({ id: doc.id, filename: doc.filename, createdAt: doc.createdAt }, { status: 201 })
}
