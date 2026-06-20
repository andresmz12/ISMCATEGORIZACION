import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { email, password, name, accountType, plan, firmName, businessName, industry, entityType } = await req.json()

    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    if (!accountType || !['ACCOUNTANT', 'INDIVIDUAL'].includes(accountType)) {
      return NextResponse.json({ error: 'Tipo de cuenta inválido' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: (name || email.split('@')[0]).trim(),
        accountType: accountType as 'ACCOUNTANT' | 'INDIVIDUAL',
        firmName: accountType === 'ACCOUNTANT' ? (firmName?.trim() || null) : null,
        plan: (['BASIC','PLUS','ENTERPRISE'].includes(plan) ? plan : 'BASIC') as 'BASIC' | 'PLUS' | 'ENTERPRISE',
        isActive: true,
      },
    })

    if (accountType === 'INDIVIDUAL' && businessName?.trim()) {
      const biz = await prisma.business.create({
        data: {
          name: businessName.trim(),
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
