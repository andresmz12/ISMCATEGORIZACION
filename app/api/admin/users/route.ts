import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function isSuperAdmin() {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.accountType === 'SUPERADMIN'
}

export async function GET() {
  if (!await isSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      accountType: true,
      plan: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      firmName: true,
      _count: { select: { businessUsers: true } },
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: Request) {
  if (!await isSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { email, password, name, accountType, plan, businessName, firmName } = await req.json()

    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    if (!accountType || !['ACCOUNTANT', 'INDIVIDUAL'].includes(accountType)) {
      return NextResponse.json({ error: 'Tipo de cuenta inválido' }, { status: 400 })
    }
    if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    if (!/[A-Z]/.test(password)) return NextResponse.json({ error: 'La contraseña debe incluir al menos una letra mayúscula' }, { status: 400 })
    if (!/[0-9]/.test(password)) return NextResponse.json({ error: 'La contraseña debe incluir al menos un número' }, { status: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: (name || normalizedEmail.split('@')[0]).trim().slice(0, 100),
        accountType: accountType as 'ACCOUNTANT' | 'INDIVIDUAL',
        firmName: accountType === 'ACCOUNTANT' ? (firmName?.trim()?.slice(0, 100) || null) : null,
        plan: (['BASIC', 'PLUS', 'ENTERPRISE'].includes(plan) ? plan : 'BASIC') as 'BASIC' | 'PLUS' | 'ENTERPRISE',
        isActive: true,
      },
    })

    if (accountType === 'INDIVIDUAL' && businessName?.trim()) {
      const biz = await prisma.business.create({
        data: { name: businessName.trim().slice(0, 100), taxYear: new Date().getFullYear() },
      })
      await prisma.businessUser.create({ data: { userId: user.id, businessId: biz.id, role: 'OWNER' } })
    }

    return NextResponse.json({ ok: true, id: user.id, email: user.email })
  } catch (e: any) {
    console.error('Admin create user error:', e)
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
  }
}
