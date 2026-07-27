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
      notifyEmail: null,
    }
  )
}

export async function PUT(req: Request) {
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const fields = [
    'providerCompanyName',
    'providerAddress',
    'providerCity',
    'providerState',
    'providerZip',
    'providerEmail',
    'providerPhone',
    'providerTaxId',
    'notifyEmail',
  ] as const

  const data: Record<string, string | null> = {}
  for (const f of fields) {
    const v = body[f]
    data[f] = typeof v === 'string' && v.trim() ? sanitizeString(v, 300) : null
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
