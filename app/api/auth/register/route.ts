import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validatePassword, validateEmail, getClientIp } from '@/lib/validate'
import { TRIAL_DURATION_MS } from '@/lib/billing-access'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per IP per hour
  if (!rl.ok) return rateLimitResponse()

  try {
    const { email, password, name, firmName, termsAccepted } = await req.json()

    if (!termsAccepted) return NextResponse.json({ error: 'Debes aceptar los Términos de Uso para continuar' }, { status: 400 })
    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    if (!validateEmail(email)) return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 })

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 12)

    // Self-registration NEVER grants a plan — every paid tier (including
    // BASIC, which is a real $20/mo charge) is only reachable by paying
    // through Square or being granted one by an admin. Previously this
    // trusted a client-supplied `plan` field straight into the DB, which let
    // anyone register with plan: "ENTERPRISE" and get full paid access for free.
    // Plan stays NONE (honest: they haven't paid), but trialEndsAt gives them
    // 7 days of BASIC-equivalent access — see lib/billing-access.ts.
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: (name || email.split('@')[0]).trim().slice(0, 100),
        accountType: 'ACCOUNTANT',
        accountRole: 'OWNER',
        isActive: true,
        termsAcceptedAt: new Date(),
        termsVersion: '2026-07-02',
        billingAccount: {
          create: {
            name: firmName?.trim()?.slice(0, 100) || null,
            plan: 'NONE',
            trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS),
          },
        },
      },
    })

    return NextResponse.json({ ok: true, id: user.id, email: user.email })
  } catch (e: any) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }
}
