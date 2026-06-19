import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [totalAccounts, totalAccountants, totalIndividuals, totalBusinesses, totalTx, aiUsage] = await Promise.all([
    prisma.user.count({ where: { accountType: { not: 'SUPERADMIN' } } }),
    prisma.user.count({ where: { accountType: 'ACCOUNTANT' } }),
    prisma.user.count({ where: { accountType: 'INDIVIDUAL' } }),
    prisma.business.count(),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { method: 'AI' } }),
  ])

  return NextResponse.json({ totalAccounts, totalAccountants, totalIndividuals, totalBusinesses, totalTx, aiUsage })
}
