import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validatePassword, validateEmail, getClientIp } from '@/lib/validate'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per IP per hour
  if (!rl.ok) return rateLimitResponse()

  try {
    const { email, password, name, accountType, plan, firmName, businessName, industry, entityType } = await req.json()

    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    if (!validateEmail(email)) return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 })

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    if (!accountType || !['ACCOUNTANT', 'INDIVIDUAL'].includes(accountType)) {
      return NextResponse.json({ error: 'Tipo de cuenta inválido' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: (name || email.split('@')[0]).trim().slice(0, 100),
        accountType: accountType as 'ACCOUNTANT' | 'INDIVIDUAL',
        firmName: accountType === 'ACCOUNTANT' ? (firmName?.trim()?.slice(0, 100) || null) : null,
        plan: (['BASIC', 'PLUS', 'ENTERPRISE'].includes(plan) ? plan : 'BASIC') as 'BASIC' | 'PLUS' | 'ENTERPRISE',
        isActive: true,
      },
    })

    if (accountType === 'INDIVIDUAL' && businessName?.trim()) {
      const biz = await prisma.business.create({
        data: {
          name: businessName.trim().slice(0, 100),
          industry: industry || null,
          entityType: entityType || null,
          taxYear: new Date().getFullYear(),
        },
      })
      await prisma.businessUser.create({
        data: { userId: user.id, businessId: biz.id, role: 'OWNER' },
      })
    }

    return NextResponse.json({ ok: true, id: user.id, email: user.email })
  } catch (e: any) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }
}
