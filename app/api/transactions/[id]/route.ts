import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessAccess(userId, tx.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { categoryId, deductibility, status, notes, method, splits } = body

  if (notes && notes.length > 1000) return NextResponse.json({ error: 'Notes too long' }, { status: 400 })

  if (splits && Array.isArray(splits) && splits.length > 0) {
    if (splits.some((s: any) => !s.categoryId || !s.amount)) {
      return NextResponse.json({ error: 'All splits must have category and amount' }, { status: 400 })
    }

    const splitTotal = splits.reduce((s: number, sp: any) => s + Number(sp.amount), 0)
    if (Math.abs(splitTotal - tx.amount) > 0.02) {
      return NextResponse.json({ error: 'Split amounts must equal transaction total' }, { status: 400 })
    }

    const categoryIds = splits.map((s: any) => s.categoryId)
    const validCats = await prisma.category.findMany({
      where: { id: { in: categoryIds }, OR: [{ businessId: tx.businessId }, { businessId: null }] },
      select: { id: true },
    })
    if (validCats.length !== categoryIds.length) {
      return NextResponse.json({ error: 'One or more categories do not exist' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (trx) => {
      await trx.transactionSplit.deleteMany({ where: { transactionId: params.id } })
      await trx.transactionSplit.createMany({
        data: splits.map((s: any) => ({
          transactionId: params.id,
          categoryId: s.categoryId,
          amount: Number(s.amount),
          deductibility: s.deductibility || null,
          notes: s.notes || null,
        })),
      })
      return trx.transaction.update({
        where: { id: params.id },
        data: {
          ...(categoryId !== undefined && { categoryId }),
          ...(deductibility !== undefined && { deductibility }),
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes }),
          ...(method !== undefined && { method }),
        },
        include: { category: true, splits: { include: { category: true } } },
      })
    })
    return NextResponse.json(updated)
  }

  if (splits && Array.isArray(splits) && splits.length === 0) {
    await prisma.transactionSplit.deleteMany({ where: { transactionId: params.id } })
  }

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(categoryId !== undefined && { categoryId }),
      ...(deductibility !== undefined && { deductibility }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(method !== undefined && { method }),
    },
    include: { category: true, splits: { include: { category: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessAccess(userId, tx.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.transaction.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: params.id })
}
