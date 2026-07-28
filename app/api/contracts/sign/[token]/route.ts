import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizeString, validateEmail, getClientIp } from '@/lib/validate'
import { regenerateContractPdf, getContractSettings, hasReusableProviderSignature } from '@/lib/contract-service'
import { sendContractReadyForCountersignEmail, sendContractCompletedEmail } from '@/lib/email'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const MAX_SIGNATURE_LENGTH = 400_000 // ~300KB of PNG bytes as base64

// Public route — no session. signToken is the entire credential; anyone
// with the link can view and, once, sign this contract.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const contract = await prisma.contract.findUnique({ where: { signToken: params.token } })
  if (!contract) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })

  return NextResponse.json({
    id: contract.id,
    status: contract.status,
    clientCompanyName: contract.clientCompanyName,
    clientAddress: contract.clientAddress,
    clientState: contract.clientState,
    clientEmail: contract.clientEmail,
    monthlyFeeCents: contract.monthlyFeeCents,
    paymentDueDay: contract.paymentDueDay,
    clientSignedAt: contract.clientSignedAt,
    providerCompanyName: contract.providerCompanyNameSnapshot,
  })
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ip = getClientIp(req)
  const rl = rateLimit(`sign:${params.token}:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const contract = await prisma.contract.findUnique({ where: { signToken: params.token } })
  if (!contract) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })

  const body = await req.json()
  const { firstName, lastName, signatureBase64, consent, clientCompanyName, clientAddress, clientState, clientEmail } = body

  if (!consent) return NextResponse.json({ error: 'Debes aceptar los términos para firmar' }, { status: 400 })
  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })
  }
  if (typeof signatureBase64 !== 'string' || !signatureBase64.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }
  if (signatureBase64.length > MAX_SIGNATURE_LENGTH) {
    return NextResponse.json({ error: 'Firma demasiado grande' }, { status: 400 })
  }

  // Existing admin-entered values win; the client can only fill what's
  // still blank, so a firm's own data entry can't be overwritten from the
  // public link.
  const finalEmail = contract.clientEmail || (typeof clientEmail === 'string' ? sanitizeString(clientEmail, 200).toLowerCase() : '')
  if (!finalEmail || !validateEmail(finalEmail)) {
    return NextResponse.json({ error: 'Se requiere un email de contacto válido' }, { status: 400 })
  }

  // Atomic guard: only a request that actually transitions SENT -> CLIENT_SIGNED
  // wins. A double-click or a retried submit that loses this race gets a 409
  // instead of silently producing a second signature on the same contract.
  const result = await prisma.contract.updateMany({
    where: { signToken: params.token, status: 'SENT' },
    data: {
      status: 'CLIENT_SIGNED',
      clientCompanyName: contract.clientCompanyName || (clientCompanyName?.trim() ? sanitizeString(clientCompanyName, 200) : null),
      clientAddress: contract.clientAddress || (clientAddress?.trim() ? sanitizeString(clientAddress, 300) : null),
      clientState: contract.clientState || (clientState?.trim() ? sanitizeString(clientState, 100) : null),
      clientEmail: finalEmail,
      clientFirstName: sanitizeString(firstName, 100),
      clientLastName: sanitizeString(lastName, 100),
      clientSignature: signatureBase64,
      clientSignedAt: new Date(),
      clientSignedIp: ip,
    },
  })

  if (result.count !== 1) {
    return NextResponse.json({ error: 'Este contrato ya fue firmado.' }, { status: 409 })
  }

  // Auditing is attributed to whoever created the contract — the external
  // signer has no account in this system, so there's no other user to log
  // the event against without redesigning AuditLog.userId to be nullable.
  await logAudit({ userId: contract.createdById, action: 'CLIENT_SIGN_CONTRACT', entity: 'Contract', entityId: contract.id, metadata: { ip } })

  const settings = await getContractSettings()

  // Only the client needs to sign for this contract to be valid in the US.
  // If the Proveedor already has a saved signature + signer name on file,
  // stamp both signatures and complete the contract in this same request —
  // no one has to open the admin panel. Otherwise fall back to the
  // two-step flow: CLIENT_SIGNED + notify staff to countersign manually.
  if (hasReusableProviderSignature(settings)) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'COMPLETED',
        providerFirstName: settings!.providerSignerFirstName,
        providerLastName: settings!.providerSignerLastName,
        providerSignature: settings!.providerSignatureDataUrl,
        providerSignedAt: new Date(),
      },
    })

    await regenerateContractPdf(contract.id, { final: true })

    const finalContract = await prisma.contract.findUniqueOrThrow({
      where: { id: contract.id },
      select: { finalPdfData: true },
    })

    await sendContractCompletedEmail({
      to: finalEmail,
      contractId: contract.id,
      providerCompanyName: contract.providerCompanyNameSnapshot || 'nuestra empresa',
      finalPdfBase64: finalContract.finalPdfData!,
    })

    await logAudit({ userId: contract.createdById, action: 'AUTO_COMPLETE_CONTRACT', entity: 'Contract', entityId: contract.id })

    return NextResponse.json({ status: 'COMPLETED' })
  }

  await regenerateContractPdf(contract.id, { final: false })

  const notifyTo = settings?.notifyEmail
  if (notifyTo) {
    const panelUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/contratos/${contract.id}`
    await sendContractReadyForCountersignEmail({
      to: notifyTo,
      contractId: contract.id,
      clientCompanyName: contract.clientCompanyName || finalEmail,
      panelUrl,
    })
  }

  return NextResponse.json({ status: 'CLIENT_SIGNED' })
}
