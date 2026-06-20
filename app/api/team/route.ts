import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const members = await prisma.user.findMany({
    where: { teamOwnerId: userId },
    select: { id: true, name: true, email: true, isActive: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(members)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const { name, email, password } = await req.json()
  if (!name || !email || !password) return NextResponse.json({ error: 'name, email y password son requeridos' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 10)

  // Get owner's plan to assign to team member
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, accountType: true } })

  const member = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      accountType: 'INDIVIDUAL',
      plan: owner?.plan ?? 'BASIC',
      teamOwnerId: userId,
    },
  })

  // Copy all owner's businesses to the new team member
  const ownerBusinesses = await prisma.businessUser.findMany({ where: { userId } })
  if (ownerBusinesses.length > 0) {
    await prisma.businessUser.createMany({
      data: ownerBusinesses.map(bu => ({
        userId: member.id,
        businessId: bu.businessId,
        role: 'VIEWER' as const,
      })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({ id: member.id, name: member.name, email: member.email }, { status: 201 })
}
