import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function isSuperAdmin() {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.accountType === 'SUPERADMIN'
}

export async function GET() {
  if (!await isSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      accountType: true,
      plan: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      firmName: true,
      _count: { select: { businessUsers: true } },
    },
  })

  return NextResponse.json(users)
}
