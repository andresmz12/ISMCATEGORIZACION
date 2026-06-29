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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, irsCode, description, isSystem } = await req.json()
  if (name && name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })

  const category = await prisma.category.findUnique({ where: { id: params.id } })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(irsCode !== undefined && { irsCode }),
      ...(description !== undefined && { description }),
      ...(isSystem !== undefined && { isSystem }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    include: { _count: { select: { transactions: true, splits: true } } },
  })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const txCount = (category as any)._count.transactions
  const splitCount = (category as any)._count.splits
  if (txCount > 0 || splitCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${txCount} transacciones y ${splitCount} divisiones la usan` },
      { status: 400 }
    )
  }

  try {
    await prisma.$transaction([
      prisma.classificationRule.deleteMany({ where: { categoryId: params.id } }),
      prisma.category.delete({ where: { id: params.id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se puede eliminar esta categoría' }, { status: 400 })
  }
}
