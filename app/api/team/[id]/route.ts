import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

async function canManage(callerId: string, targetId: string): Promise<boolean> {
  if (callerId === targetId) return false // can't manage yourself via team endpoint

  // Find shared businesses where caller is OWNER and target is NOT owner
  const shared = await prisma.businessUser.findMany({
    where: {
      userId: callerId,
      role: 'OWNER',
      business: { users: { some: { userId: targetId } } },
    },
  })
  if (shared.length === 0) return false

  // Make sure target is not an OWNER in any of those shared businesses
  const targetOwnership = await prisma.businessUser.findFirst({
    where: { userId: targetId, businessId: { in: shared.map(s => s.businessId) }, role: 'OWNER' },
  })
  return !targetOwnership
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerId = (session.user as any).id
  const accountType = (session.user as any).accountType

  if (accountType !== 'SUPERADMIN' && !(await canManage(callerId, params.id))) {
    return NextResponse.json({ error: 'No puedes modificar este usuario' }, { status: 403 })
  }

  const body = await req.json()

  if (body.password && body.password.length > 0) {
    const pwErr = validatePassword(body.password)
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })
  }

  const data: any = {}
  if (body.name !== undefined && body.name.trim()) data.name = body.name.trim()
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, isActive: true, lastLogin: true },
  })

  await logAudit({ userId: callerId, businessId: null, action: 'UPDATE_TEAM_MEMBER', entity: 'User', entityId: params.id })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerId = (session.user as any).id
  const accountType = (session.user as any).accountType

  // Protect owner accounts: only SUPERADMIN or the original owner can delete
  if (accountType !== 'SUPERADMIN' && !(await canManage(callerId, params.id))) {
    return NextResponse.json({ error: 'No puedes eliminar este usuario' }, { status: 403 })
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { accountType: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.accountType === 'SUPERADMIN') {
    return NextResponse.json({ error: 'No se puede eliminar un superadmin' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  await logAudit({ userId: callerId, businessId: null, action: 'DELETE_TEAM_MEMBER', entity: 'User', entityId: params.id })
  return NextResponse.json({ ok: true })
}
