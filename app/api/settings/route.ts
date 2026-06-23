import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/validate'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, firmName, currentPassword, newPassword } = body

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updates: Record<string, any> = {}

  if (name !== undefined) {
    if (!name || name.trim().length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 })
    if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })
    updates.name = name.trim()
  }

  if (firmName !== undefined) {
    updates.firmName = firmName?.trim()?.slice(0, 100) || null
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })
    const pwError = validatePassword(newPassword)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })
    updates.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { id: true, name: true, email: true, firmName: true, accountType: true, plan: true },
  })

  return NextResponse.json(updated)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, firmName: true, accountType: true, plan: true, createdAt: true, lastLogin: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}
