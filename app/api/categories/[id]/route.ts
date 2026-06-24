import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const category = await prisma.category.findUnique({ where: { id: params.id } })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (accountType !== 'SUPERADMIN') {
    if (category.isSystem) return NextResponse.json({ error: 'Cannot delete system categories' }, { status: 403 })
    if (!category.businessId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!await checkBusinessAccess(userId, category.businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    await prisma.category.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Cannot delete category in use' }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const category = await prisma.category.findUnique({ where: { id: params.id } })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (accountType !== 'SUPERADMIN') {
    if (category.isSystem) return NextResponse.json({ error: 'Cannot edit system categories' }, { status: 403 })
    if (!category.businessId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!await checkBusinessAccess(userId, category.businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { name, irsCode, description } = await req.json()
  if (name && name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(irsCode !== undefined && { irsCode }),
      ...(description !== undefined && { description }),
    },
  })
  return NextResponse.json(updated)
}
