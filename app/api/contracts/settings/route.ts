import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeString, validateEmail } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function GET() {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await prisma.contractSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json(
    settings ?? {
      id: 1,
      providerCompanyName: null,
      providerAddress: null,
      providerCity: null,
      providerState: null,
      providerZip: null,
      providerEmail: null,
      providerPhone: null,
      providerTaxId: null,
      providerSignerFirstName: null,
      providerSignerLastName: null,
      providerSignatureDataUrl: null,
      notifyEmail: null,
    }
  )
}

const TEXT_FIELDS = [
  'providerCompanyName',
  'providerAddress',
  'providerCity',
  'providerState',
  'providerZip',
  'providerEmail',
  'providerPhone',
  'providerTaxId',
  'providerSignerFirstName',
  'providerSignerLastName',
  'notifyEmail',
] as const

export async function PUT(req: Request) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  const data: Record<string, string | null> = {}
  for (const f of TEXT_FIELDS) {
    const v = body[f]
    data[f] = typeof v === 'string' && v.trim() ? sanitizeString(v, 300) : null
  }

  // The signature is only ever replaced when the admin actually redrew it —
  // saving the rest of the form (e.g. just the address) must not wipe out a
  // signature that's already on file, since it's meant to be drawn once and
  // reused across every contract.
  if (typeof body.providerSignatureDataUrl === 'string' && body.providerSignatureDataUrl.startsWith('data:image/')) {
    data.providerSignatureDataUrl = body.providerSignatureDataUrl
  } else if (body.providerSignatureDataUrl === null) {
    data.providerSignatureDataUrl = null // explicit "cambiar firma" clear
  }

  if (data.providerEmail && !validateEmail(data.providerEmail)) {
    return NextResponse.json({ error: 'Email del proveedor inválido' }, { status: 400 })
  }
  if (data.notifyEmail && !validateEmail(data.notifyEmail)) {
    return NextResponse.json({ error: 'Email de notificación inválido' }, { status: 400 })
  }

  const settings = await prisma.contractSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })

  await logAudit({ userId: (session.user as any).id, action: 'UPDATE_CONTRACT_SETTINGS', entity: 'ContractSettings', entityId: '1' })
  return NextResponse.json(settings)
}
