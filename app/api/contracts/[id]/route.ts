import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      providerSignedBy: { select: { name: true, email: true } },
    },
  })
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { pdfData, finalPdfData, clientSignature, providerSignature, signToken, ...rest } = contract
  return NextResponse.json({
    ...rest,
    hasDraftPdf: !!pdfData,
    hasFinalPdf: !!finalPdfData,
    hasClientSignature: !!clientSignature,
    hasProviderSignature: !!providerSignature,
    signUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/sign/${signToken}`,
  })
}

// Allowed in any status. The full contract is snapshotted into the audit log
// before deletion (base64 signature/PDF blobs redacted so a delete doesn't
// balloon AuditLog.metadata) since this is the only record of the contract
// left afterward.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const {
    pdfData,
    finalPdfData,
    clientSignature,
    providerSignature,
    ...snapshot
  } = contract

  await prisma.contract.delete({ where: { id: params.id } })

  const userId = (session.user as any).id
  await logAudit({
    userId,
    action: 'DELETE_CONTRACT',
    entity: 'Contract',
    entityId: params.id,
    metadata: { ...snapshot, hadClientSignature: !!clientSignature, hadProviderSignature: !!providerSignature },
  })

  return NextResponse.json({ ok: true })
}
