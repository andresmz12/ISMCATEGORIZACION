import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeString } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { regenerateContractPdf } from '@/lib/contract-service'
import { sendContractCompletedEmail } from '@/lib/email'

const MAX_SIGNATURE_LENGTH = 400_000 // ~300KB of PNG bytes as base64

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

// Countersignature step. Uses an atomic UPDATE ... WHERE status = 'CLIENT_SIGNED'
// (via updateMany's row count) instead of read-then-write, so two admins
// clicking "contrafirmar" at once can't both succeed and produce two
// signatures on the same contract.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { firstName, lastName, signatureBase64 } = body

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })
  }
  if (typeof signatureBase64 !== 'string' || !signatureBase64.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }
  if (signatureBase64.length > MAX_SIGNATURE_LENGTH) {
    return NextResponse.json({ error: 'Firma demasiado grande' }, { status: 400 })
  }

  const userId = (session.user as any).id

  const result = await prisma.contract.updateMany({
    where: { id: params.id, status: 'CLIENT_SIGNED' },
    data: {
      status: 'COMPLETED',
      providerFirstName: sanitizeString(firstName, 100),
      providerLastName: sanitizeString(lastName, 100),
      providerSignature: signatureBase64,
      providerSignedAt: new Date(),
      providerSignedById: userId,
    },
  })

  if (result.count !== 1) {
    const existing = await prisma.contract.findUnique({ where: { id: params.id }, select: { status: true } })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Este contrato no está listo para contrafirma (ya fue completado o el cliente aún no firma).' }, { status: 409 })
  }

  await regenerateContractPdf(params.id, { final: true })

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: params.id },
    select: { finalPdfData: true, clientEmail: true, pdfHash: true },
  })
  const settings = await prisma.contractSettings.findUnique({ where: { id: 1 } })

  if (contract.clientEmail && contract.finalPdfData) {
    await sendContractCompletedEmail({
      to: contract.clientEmail,
      contractId: params.id,
      providerCompanyName: settings?.providerCompanyName || 'nuestra empresa',
      finalPdfBase64: contract.finalPdfData,
    })
  }

  await logAudit({ userId, action: 'COUNTERSIGN_CONTRACT', entity: 'Contract', entityId: params.id, metadata: { pdfHash: contract.pdfHash } })

  return NextResponse.json({ id: params.id, status: 'COMPLETED', pdfHash: contract.pdfHash })
}
