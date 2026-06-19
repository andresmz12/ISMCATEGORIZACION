import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AccountType } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const { email, password, name, accountType, firmName, businessName, industry, entityType } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

    const type: AccountType = accountType === 'ACCOUNTANT' ? AccountType.ACCOUNTANT : AccountType.INDIVIDUAL
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split('@')[0],
        accountType: type,
        firmName: type === AccountType.ACCOUNTANT ? (firmName || null) : null,
        plan: 'BASIC',
        isActive: true,
      },
    })

    if (type === AccountType.INDIVIDUAL && businessName) {
      const biz = await prisma.business.create({
        data: {
          name: businessName,
          industry: industry || null,
          entityType: entityType || null,
          taxYear: new Date().getFullYear(),
        },
      })
      await prisma.businessUser.create({
        data: { userId: user.id, businessId: biz.id, role: 'OWNER' },
      })
    }

    return NextResponse.json({ id: user.id, email: user.email })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
