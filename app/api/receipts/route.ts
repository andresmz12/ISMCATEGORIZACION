import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function checkAccess(userId: string, businessId: string) {
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  return !!bu
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const formData = await req.formData()
  const transactionId = formData.get('transactionId') as string
  const file = formData.get('file') as File
  if (!transactionId || !file) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (!await checkAccess(userId, tx.businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

  const data = buffer.toString('base64')
  const receipt = await prisma.receipt.create({
    data: { transactionId, filename: file.name, data, mimeType: file.type },
  })
  return NextResponse.json({ id: receipt.id, filename: receipt.filename })
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const transactionId = searchParams.get('transactionId')
  const businessId = searchParams.get('businessId')

  // List all receipts for a business (for the receipts page)
  if (businessId) {
    if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const receipts = await prisma.receipt.findMany({
      where: { transaction: { businessId } },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        createdAt: true,
        transaction: {
          select: {
            id: true, description: true, amount: true, date: true,
            status: true, categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
    const total = await prisma.receipt.count({ where: { transaction: { businessId } } })
    return NextResponse.json({ receipts, total, page, limit })
  }

  // List receipts for a specific transaction
  if (!transactionId) return NextResponse.json({ error: 'transactionId or businessId required' }, { status: 400 })
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkAccess(userId, tx.businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const receipts = await prisma.receipt.findMany({
    where: { transactionId },
    select: { id: true, filename: true, mimeType: true, createdAt: true },
  })
  return NextResponse.json(receipts)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { transaction: { select: { businessId: true } } },
  })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkAccess(userId, receipt.transaction.businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.receipt.delete({ where: { id } })
  return NextResponse.json({ deleted: id })
}
