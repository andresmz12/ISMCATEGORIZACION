import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendContractSignRequestEmail } from '@/lib/email'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

// Re-sends the SAME signToken/link — never generates a new contract — for
// when the client just didn't see the original email.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (contract.status !== 'SENT') {
    return NextResponse.json({ error: 'Solo se puede reenviar un contrato que aún espera la firma del cliente.' }, { status: 409 })
  }
  if (!contract.clientEmail) {
    return NextResponse.json({ error: 'Este contrato no tiene email de cliente registrado.' }, { status: 400 })
  }

  const signUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/sign/${contract.signToken}`

  await sendContractSignRequestEmail({
    to: contract.clientEmail,
    signUrl,
    contractId: contract.id,
    pdfBase64: contract.pdfData ?? undefined,
    providerCompanyName: contract.providerCompanyNameSnapshot || 'nuestra empresa',
    isResend: true,
  })

  const userId = (session.user as any).id
  await logAudit({ userId, action: 'RESEND_CONTRACT', entity: 'Contract', entityId: contract.id })

  return NextResponse.json({ ok: true })
}
