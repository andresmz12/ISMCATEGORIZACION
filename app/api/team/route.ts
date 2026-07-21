import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateEmail, getClientIp } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { sendWelcomeEmail } from '@/lib/email'
import { requirePlanFeature } from '@/lib/plan-limits'

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = requirePlanFeature(session, 'team')
  if (denied) return denied

  const ownerId = (session.user as any).id

  // Return all users that share at least one business with the current user
  // where the current user is OWNER or MANAGER of that business
  const myBusinessIds = await prisma.businessUser.findMany({
    where: { userId: ownerId, role: { in: ['OWNER', 'MANAGER'] } },
    select: { businessId: true },
  })

  if (myBusinessIds.length === 0) return NextResponse.json([])

  const businessIds = myBusinessIds.map(b => b.businessId)

  // Get all users on those businesses, excluding the current user
  const members = await prisma.businessUser.findMany({
    where: { businessId: { in: businessIds }, userId: { not: ownerId } },
    include: { user: { select: { id: true, name: true, email: true, isActive: true, lastLogin: true, createdAt: true, accountType: true } } },
    distinct: ['userId'],
  })

  const unique = Array.from(
    new Map(members.map(m => [m.userId, { ...m.user, role: m.role }])).values()
  )

  return NextResponse.json(unique)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const denied = requirePlanFeature(session, 'team')
  if (denied) return denied

  const ip = getClientIp(req)
  const rl = rateLimit(`team-create:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const body = await req.json()
  const { name, email, businessId } = body

  if (!name?.trim() || !email) {
    return NextResponse.json({ error: 'Nombre y correo son requeridos' }, { status: 400 })
  }
  if (!validateEmail(email)) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })

  const ownerId = (session.user as any).id

  // Determine which businesses to add the new user to
  let targetBusinessIds: string[]
  if (businessId) {
    // Verify caller is OWNER/MANAGER of this business
    const bu = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId: ownerId, businessId } },
    })
    if (!bu || bu.role === 'VIEWER') {
      return NextResponse.json({ error: 'No tienes permiso para agregar usuarios a este negocio' }, { status: 403 })
    }
    targetBusinessIds = [businessId]
  } else {
    // Add to ALL businesses where caller is OWNER
    const myBizs = await prisma.businessUser.findMany({
      where: { userId: ownerId, role: 'OWNER' },
      select: { businessId: true },
    })
    targetBusinessIds = myBizs.map(b => b.businessId)
  }

  if (targetBusinessIds.length === 0) {
    return NextResponse.json({ error: 'No tienes negocios para asignar este usuario' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { accountId: true } })

  // No one — not the owner creating this account, not this server's logs, not
  // an email — ever knows this password. The new user sets their own via the
  // invite link below; this hash exists only to satisfy the required column.
  const unusablePassword = crypto.randomBytes(32).toString('hex')
  const passwordHash = await bcrypt.hash(unusablePassword, 12)
  const inviteToken = crypto.randomBytes(32).toString('hex')
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS)

  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      accountType: 'TEAM_MEMBER',
      accountId: owner!.accountId,
      accountRole: 'MEMBER',
      inviteToken,
      inviteTokenExpiresAt,
      businessUsers: {
        create: targetBusinessIds.map(bId => ({ businessId: bId, role: 'VIEWER' })),
      },
    },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
  })

  await logAudit({ userId: ownerId, businessId: targetBusinessIds[0], action: 'CREATE_TEAM_MEMBER', entity: 'User', entityId: newUser.id })

  const appUrl = process.env.NEXTAUTH_URL || 'https://www.myprofitandloss.com'
  const inviteUrl = `${appUrl}/invitar/${inviteToken}`

  // Send welcome email (non-blocking) — inviteUrl is also returned below so
  // the admin can share it directly if SendGrid isn't configured or the send fails.
  try {
    const [inviter, business] = await Promise.all([
      prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } }),
      prisma.business.findUnique({ where: { id: targetBusinessIds[0] }, select: { name: true } }),
    ])
    await sendWelcomeEmail({
      to: newUser.email,
      name: newUser.name || newUser.email,
      inviteUrl,
      businessName: business?.name || 'tu equipo',
      inviterName: inviter?.name || 'Tu administrador',
    })
  } catch (err: any) {
    const detail = err?.response?.body || err?.message || err
    console.error('[email] welcome email failed:', JSON.stringify(detail))
  }

  return NextResponse.json({ ...newUser, inviteUrl }, { status: 201 })
}
