import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validatePassword, getClientIp } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

// Public endpoint — the token itself is the credential proving the caller
// received the invite email. No session required.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`accept-invite:${ip}`, 10, 15 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token || !password) {
    return NextResponse.json({ error: 'token y password son requeridos' }, { status: 400 })
  }

  const pwErr = validatePassword(password)
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { id: true, inviteTokenExpiresAt: true },
  })
  if (!user || !user.inviteTokenExpiresAt || user.inviteTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Este enlace de invitación no es válido o ya expiró' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isActive: true, inviteToken: null, inviteTokenExpiresAt: null },
  })

  await logAudit({ userId: user.id, action: 'ACCEPT_INVITE', entity: 'User', entityId: user.id })

  return NextResponse.json({ ok: true })
}
