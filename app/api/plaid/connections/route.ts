import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { plaidClient } from '@/lib/plaid'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const connections = await prisma.plaidConnection.findMany({
    where: { businessId },
    include: { accounts: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(connections.map((c: typeof connections[number]) => ({
    id: c.id,
    institutionName: c.institutionName,
    lastSyncAt: c.lastSyncAt,
    createdAt: c.createdAt,
    accounts: c.accounts.map((a: typeof c.accounts[number]) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
    })),
  })))
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const { searchParams } = new URL(req.url)
  const connectionId = searchParams.get('connectionId')
  const businessId = searchParams.get('businessId')
  if (!connectionId || !businessId) {
    return NextResponse.json({ error: 'connectionId y businessId requeridos' }, { status: 400 })
  }
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const connection = await prisma.plaidConnection.findFirst({
    where: { id: connectionId, businessId },
  })
  if (!connection) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })

  try {
    await plaidClient.itemRemove({ access_token: connection.accessToken })
  } catch (e) {
    console.warn('plaid itemRemove warning:', e)
  }

  await prisma.plaidConnection.delete({ where: { id: connectionId } })

  await logAudit({
    userId,
    businessId,
    action: 'PLAID_DISCONNECT',
    entity: 'PlaidConnection',
    entityId: connectionId,
    metadata: { institutionName: connection.institutionName },
  })

  return NextResponse.json({ ok: true })
}
