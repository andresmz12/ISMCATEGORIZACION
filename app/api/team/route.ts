import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validatePassword, validateEmail, getClientIp } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

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

  const ip = getClientIp(req)
  const rl = rateLimit(`team-create:${userId}:${ip}`, 10, 60 * 60 * 1000) // 10 per hour
  if (!rl.ok) return rateLimitResponse()

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email y password son requeridos' }, { status: 400 })
  }
  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 })
  }

  const pwError = validatePassword(password)
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)

  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })

  const member = await prisma.user.create({
    data: {
      name: name.trim().slice(0, 100),
      email: normalizedEmail,
      passwordHash,
      accountType: 'INDIVIDUAL',
      plan: owner?.plan ?? 'BASIC',
      teamOwnerId: userId,
    },
  })

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

  await logAudit({ userId, action: 'INVITE_TEAM_MEMBER', entity: 'User', entityId: member.id, metadata: { email: normalizedEmail } })
  return NextResponse.json({ id: member.id, name: member.name, email: member.email }, { status: 201 })
}
