import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
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

  const types = await prisma.documentType.findMany({
    where: { businessId },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(types)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { businessId, name, description, required } = body
  if (!businessId || !name?.trim()) {
    return NextResponse.json({ error: 'businessId y name son requeridos' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  if (!(await checkBusinessAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docType = await prisma.documentType.create({
    data: { businessId, name: name.trim(), description: description?.trim() || null, required: !!required },
  })

  await logAudit({ userId: userId, businessId: businessId, action: 'CREATE_DOCUMENT_TYPE', entity: 'DocumentType', entityId: docType.id })
  return NextResponse.json(docType, { status: 201 })
}
