import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { plaidClient } from '@/lib/plaid'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'

function makeChecksum(date: string, description: string, amount: number): string {
  return crypto.createHash('md5').update(`${date}|${description}|${amount}`).digest('hex')
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const plan = (session.user as any).plan
  const accountType = (session.user as any).accountType

  if (plan === 'BASIC' && accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Requiere plan PLUS o ENTERPRISE' }, { status: 403 })
  }

  const { connectionId, businessId } = await req.json()
  if (!connectionId || !businessId) {
    return NextResponse.json({ error: 'connectionId y businessId requeridos' }, { status: 400 })
  }
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const connection = await prisma.plaidConnection.findFirst({
    where: { id: connectionId, businessId },
    include: { accounts: true },
  })
  if (!connection) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })

  try {
    let cursor = connection.cursor ?? undefined
    let imported = 0
    let duplicates = 0
    let hasMore = true

    while (hasMore) {
      const syncRes = await plaidClient.transactionsSync({
        access_token: connection.accessToken,
        cursor,
        count: 100,
      })
      const { added, modified, next_cursor } = syncRes.data
      hasMore = syncRes.data.has_more
      cursor = next_cursor

      const allTx = [...added, ...modified]

      for (const tx of allTx) {
        if (tx.pending) continue

        const dateStr = tx.date
        const description = tx.merchant_name || tx.name || ''
        const amount = Math.abs(tx.amount)
        // Plaid: positive amount = money out (debit), negative = money in (credit)
        const type = tx.amount > 0 ? 'DEBIT' : 'CREDIT'
        const date = new Date(`${dateStr}T12:00:00`)
        const checksum = makeChecksum(dateStr, description, amount)

        // Find source account name
        const account = connection.accounts.find((a: { plaidId: string; name: string }) => a.plaidId === tx.account_id)
        const sourceFile = `Plaid - ${account?.name ?? connection.institutionName}`

        // Check duplicate by plaidTransactionId first, then checksum
        const existing = await prisma.transaction.findFirst({
          where: {
            businessId,
            OR: [
              { plaidTransactionId: tx.transaction_id },
              { checksum, businessId },
            ],
          },
          select: { id: true },
        })

        if (existing) {
          duplicates++
          continue
        }

        await prisma.transaction.create({
          data: {
            businessId,
            date,
            description,
            amount,
            type,
            status: 'PENDING',
            checksum,
            sourceFile,
            plaidTransactionId: tx.transaction_id,
          },
        })
        imported++
      }
    }

    await prisma.plaidConnection.update({
      where: { id: connectionId },
      data: { cursor, lastSyncAt: new Date() },
    })

    await logAudit({
      userId,
      businessId,
      action: 'PLAID_SYNC',
      entity: 'PlaidConnection',
      entityId: connectionId,
      metadata: { imported, duplicates },
    })

    return NextResponse.json({ imported, duplicates })
  } catch (e: any) {
    console.error('plaid sync error:', e?.response?.data || e)
    return NextResponse.json({ error: 'Error al sincronizar transacciones' }, { status: 500 })
  }
}
