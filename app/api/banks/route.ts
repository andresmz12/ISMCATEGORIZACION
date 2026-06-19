import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function checkAccess(userId: string, businessId: string) {
  const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
  return !!bu
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkAccess(userId, businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const mappings = await prisma.bankFormatMapping.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(mappings)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const mapping = await prisma.bankFormatMapping.findUnique({ where: { id } })
  if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkAccess(userId, mapping.businessId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.bankFormatMapping.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
