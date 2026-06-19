import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId: tx.businessId } } })
  if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { categoryId, deductibility, status, notes, method, splits } = body

  // Handle splits if provided
  if (splits && Array.isArray(splits)) {
    await prisma.transactionSplit.deleteMany({ where: { transactionId: params.id } })
    if (splits.length > 0) {
      await prisma.transactionSplit.createMany({
        data: splits.map((s: any) => ({
          transactionId: params.id,
          categoryId: s.categoryId,
          amount: Number(s.amount),
          deductibility: s.deductibility || null,
          notes: s.notes || null,
        })),
      })
    }
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
  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId: tx.businessId } } })
  if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.transaction.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: params.id })
}
