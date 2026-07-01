import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { plaidClient } from '@/lib/plaid'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { getPlanLimits } from '@/lib/plan-limits'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const plan = (session.user as any).plan
  const accountType = (session.user as any).accountType

  if (!getPlanLimits(plan).plaid && accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'La conexión bancaria requiere plan PLUS, ENTERPRISE o CUSTOM' }, { status: 403 })
  }

  const { public_token, businessId, institutionName, accounts } = await req.json()
  if (!public_token || !businessId) {
    return NextResponse.json({ error: 'public_token y businessId requeridos' }, { status: 400 })
  }
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    const connection = await prisma.plaidConnection.create({
      data: {
        businessId,
        accessToken: access_token,
        itemId: item_id,
        institutionName: institutionName || 'Banco',
        accounts: {
          create: (accounts || []).map((a: any) => ({
            plaidId: a.id,
            name: a.name,
            mask: a.mask || null,
            type: a.type || 'depository',
          })),
        },
      },
      include: { accounts: true },
    })

    await logAudit({
      userId,
      businessId,
      action: 'PLAID_CONNECT',
      entity: 'PlaidConnection',
      entityId: connection.id,
      metadata: { institutionName, accountCount: connection.accounts.length },
    })

    return NextResponse.json({ id: connection.id, institutionName: connection.institutionName })
  } catch (e: any) {
    console.error('plaid exchange error:', e?.response?.data || e)
    return NextResponse.json({ error: 'Error al conectar con Plaid' }, { status: 500 })
  }
}
