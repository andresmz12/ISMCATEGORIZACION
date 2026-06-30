import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function GET() {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const categories = await prisma.category.findMany({
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { transactions: true, splits: true } },
    },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, irsCode, description, isSystem } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const category = await prisma.category.create({
    data: {
      id: `sys_${nanoid(8)}`,
      name,
      irsCode: irsCode || null,
      description: description || null,
      isSystem: isSystem === true,
    },
  })
  return NextResponse.json(category)
}
