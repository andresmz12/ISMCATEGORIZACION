import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  if (body.aiMonthlyBudgetCents !== undefined) {
    const value = body.aiMonthlyBudgetCents === null ? null : Number(body.aiMonthlyBudgetCents)
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'aiMonthlyBudgetCents must be a non-negative number or null' }, { status: 400 })
    }
    await prisma.business.update({ where: { id: params.id }, data: { aiMonthlyBudgetCents: value } })
  }

  if (body.chatbotEnabled !== undefined) {
    await prisma.business.update({ where: { id: params.id }, data: { chatbotEnabled: !!body.chatbotEnabled } })
  }

  if (body.unblockAiUsage === true) {
    await prisma.aiUsage.upsert({
      where: { businessId_period: { businessId: params.id, period: currentPeriod() } },
      create: { businessId: params.id, period: currentPeriod(), unblockedByAdmin: true },
      update: { unblockedByAdmin: true },
    })
  }

  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: { aiUsage: { where: { period: currentPeriod() } } },
  })
  return NextResponse.json(business)
}
