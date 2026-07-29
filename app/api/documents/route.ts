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

// Matches the file picker's `accept` list in app/(dashboard)/documentos/page.tsx.
// Magic-byte signatures are only checked for formats that have a reliable one;
// legacy Office/CSV files are allowlisted by declared type only.
const MAGIC_BYTES: Record<string, string[]> = {
  'application/pdf': ['25504446'], // %PDF
  'image/png': ['89504e47'],
  'image/jpeg': ['ffd8ff'],
  'application/msword': ['d0cf11e0'], // legacy OLE (.doc/.xls)
  'application/vnd.ms-excel': ['d0cf11e0'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'], // zip (.docx/.xlsx)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504b0304'],
}
const ALLOWED_MIME_TYPES = new Set([...Object.keys(MAGIC_BYTES), 'text/csv', 'text/plain'])

function contentMatchesMimeType(base64: string, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) return true // no known signature for this type (e.g. CSV) — allowlist membership is the only check
  const header = Buffer.from(base64.slice(0, 16), 'base64').toString('hex')
  return signatures.some(sig => header.startsWith(sig))
}

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

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }
  if (!contentMatchesMimeType(data, mimeType)) {
    return NextResponse.json({ error: 'El contenido del archivo no coincide con su tipo declarado' }, { status: 400 })
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
