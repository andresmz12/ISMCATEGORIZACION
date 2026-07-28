import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeString, validateEmail } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { regenerateContractPdf, requireProviderSettings } from '@/lib/contract-service'
import { sendContractSignRequestEmail } from '@/lib/email'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function POST(req: Request) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await requireProviderSettings()
  if (!settings) {
    return NextResponse.json(
      { error: 'Configura los datos del Proveedor (empresa y dirección) en Ajustes antes de crear contratos.' },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { clientCompanyName, clientAddress, clientState, clientEmail, monthlyFeeCents, paymentDueDay } = body

  if (clientEmail && !validateEmail(clientEmail)) {
    return NextResponse.json({ error: 'Email del cliente inválido' }, { status: 400 })
  }

  if (monthlyFeeCents != null && (typeof monthlyFeeCents !== 'number' || monthlyFeeCents < 0)) {
    return NextResponse.json({ error: 'Tarifa mensual inválida' }, { status: 400 })
  }

  if (paymentDueDay != null && (typeof paymentDueDay !== 'number' || paymentDueDay < 1 || paymentDueDay > 31)) {
    return NextResponse.json({ error: 'Día de pago inválido (debe ser entre 1 y 31)' }, { status: 400 })
  }

  const userId = (session.user as any).id

  const contract = await prisma.contract.create({
    data: {
      createdById: userId,
      clientCompanyName: clientCompanyName?.trim() ? sanitizeString(clientCompanyName, 200) : null,
      clientAddress: clientAddress?.trim() ? sanitizeString(clientAddress, 300) : null,
      clientState: clientState?.trim() ? sanitizeString(clientState, 100) : null,
      clientEmail: clientEmail?.trim() ? sanitizeString(clientEmail, 200).toLowerCase() : null,
      monthlyFeeCents: monthlyFeeCents ?? null,
      paymentDueDay: paymentDueDay ?? null,
    },
  })

  await regenerateContractPdf(contract.id, { final: false })

  const signUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/sign/${contract.signToken}`

  if (contract.clientEmail) {
    await sendContractSignRequestEmail({
      to: contract.clientEmail,
      signUrl,
      providerCompanyName: settings.providerCompanyName || 'nuestra empresa',
    })
  }

  await logAudit({ userId, action: 'CREATE_CONTRACT', entity: 'Contract', entityId: contract.id })

  return NextResponse.json({ id: contract.id, signToken: contract.signToken, signUrl, status: contract.status }, { status: 201 })
}
