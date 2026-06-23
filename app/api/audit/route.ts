import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = 50
  const skip = (page - 1) * limit

  // Build where clause — users only see their own logs unless SUPERADMIN
  const where: any = accountType === 'SUPERADMIN' ? {} : { userId }
  if (businessId) where.businessId = businessId

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
}
