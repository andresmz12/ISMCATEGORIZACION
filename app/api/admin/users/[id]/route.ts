import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}

  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.plan && ['BASIC', 'PLUS', 'ENTERPRISE'].includes(body.plan)) data.plan = body.plan
  if (body.name) data.name = body.name

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, isActive: true, plan: true },
  })

  return NextResponse.json(user)
}
