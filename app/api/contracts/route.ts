import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function GET(req: Request) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const contracts = await prisma.contract.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      signToken: true,
      clientCompanyName: true,
      clientEmail: true,
      createdAt: true,
      clientSignedAt: true,
      providerSignedAt: true,
      createdBy: { select: { name: true, email: true } },
      providerSignedBy: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json(contracts)
}
