import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formData = await req.formData()
  const transactionId = formData.get('transactionId') as string
  const file = formData.get('file') as File
  if (!transactionId || !file) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  const data = buffer.toString('base64')
  const receipt = await prisma.receipt.create({
    data: { transactionId, filename: file.name, data, mimeType: file.type },
  })
  return NextResponse.json({ id: receipt.id, filename: receipt.filename })
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const transactionId = searchParams.get('transactionId')
  if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 })
  const receipts = await prisma.receipt.findMany({
    where: { transactionId },
    select: { id: true, filename: true, mimeType: true, createdAt: true },
  })
  return NextResponse.json(receipts)
}
