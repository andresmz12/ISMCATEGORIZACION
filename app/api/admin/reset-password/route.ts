import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// POST /api/admin/reset-password
// Body: { secret: string, email: string, newPassword: string }
// Requires ADMIN_RESET_SECRET env var to be set on the server
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rl = rateLimit(`reset-pw:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  const resetSecret = process.env.ADMIN_RESET_SECRET
  if (!resetSecret) {
    return NextResponse.json({ error: 'ADMIN_RESET_SECRET not configured' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.secret || !body?.email || !body?.newPassword) {
    return NextResponse.json({ error: 'secret, email and newPassword required' }, { status: 400 })
  }

  if (!secretsMatch(String(body.secret), resetSecret)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const email = String(body.email).toLowerCase().trim()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const hash = await bcrypt.hash(body.newPassword, 12)
  await prisma.user.update({
    where: { email },
    data: { passwordHash: hash, isActive: true },
  })

  return NextResponse.json({ ok: true, message: 'Password reset successfully' })
}
