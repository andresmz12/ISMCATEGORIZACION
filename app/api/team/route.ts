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

  // Team management disabled for now
  return NextResponse.json([])
}

export async function POST(req: Request) {
  // Team management disabled for now
  return NextResponse.json({ error: 'Team features temporarily disabled' }, { status: 503 })
}
