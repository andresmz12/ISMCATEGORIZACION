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

const PAGE_SIZE = 20

export async function GET(req: Request) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  // Newly created contracts may not have a clientCompanyName yet, so search
  // has to match clientEmail too — otherwise a contract sitting in "sent"
  // without a company name is unfindable by anything but scrolling.
  const where = {
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { clientCompanyName: { contains: search, mode: 'insensitive' as const } },
            { clientEmail: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    prisma.contract.count({ where }),
  ])

  return NextResponse.json({ contracts, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
}
