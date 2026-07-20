import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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
  const data: Record<string, any> = {}

  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.name !== undefined) data.name = body.name
  if (body.email && typeof body.email === 'string') data.email = body.email.toLowerCase().trim()
  if (body.accountType && ['ACCOUNTANT', 'SUPERADMIN', 'TEAM_MEMBER'].includes(body.accountType)) data.accountType = body.accountType
  if (body.password && body.password.length >= 8) {
    data.passwordHash = await bcrypt.hash(body.password, 12)
  }

  // Plan, AI budget, and chatbot access all live on the shared BillingAccount,
  // not the User — changing any of them here changes it for every user
  // (owner + invited team members) on that account, and for every business
  // the account owns.
  const touchesAccount = body.plan !== undefined || body.aiMonthlyBudgetCents !== undefined ||
    body.chatbotEnabled !== undefined || body.unblockAiUsage === true
  if (touchesAccount) {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { accountId: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const accountData: Record<string, any> = {}
    if (body.plan && ['NONE', 'BASIC', 'PLUS', 'ENTERPRISE', 'CUSTOM'].includes(body.plan)) accountData.plan = body.plan
    if (body.aiMonthlyBudgetCents !== undefined) {
      const value = body.aiMonthlyBudgetCents === null ? null : Number(body.aiMonthlyBudgetCents)
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: 'aiMonthlyBudgetCents must be a non-negative number or null' }, { status: 400 })
      }
      accountData.aiMonthlyBudgetCents = value
    }
    if (typeof body.chatbotEnabled === 'boolean') accountData.chatbotEnabled = body.chatbotEnabled
    if (Object.keys(accountData).length > 0) {
      await prisma.billingAccount.update({ where: { id: target.accountId }, data: accountData })
    }

    if (body.unblockAiUsage === true) {
      await prisma.aiUsage.upsert({
        where: { accountId_period: { accountId: target.accountId, period: currentPeriod() } },
        create: { accountId: target.accountId, period: currentPeriod(), unblockedByAdmin: true },
        update: { unblockedByAdmin: true },
      })
    }
  }

  const period = currentPeriod()
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true, email: true, isActive: true,
      billingAccount: {
        select: { plan: true, aiMonthlyBudgetCents: true, chatbotEnabled: true, aiUsage: { where: { period } } },
      },
    },
  })

  return NextResponse.json({
    ...user,
    plan: user.billingAccount.plan,
    aiMonthlyBudgetCents: user.billingAccount.aiMonthlyBudgetCents,
    chatbotEnabled: user.billingAccount.chatbotEnabled,
    aiUsage: user.billingAccount.aiUsage,
    billingAccount: undefined,
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { accountType: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.accountType === 'SUPERADMIN') {
    return NextResponse.json({ error: 'Cannot delete superadmin' }, { status: 400 })
  }

  // Cascade: delete businesses owned solely by this user
  const ownedBusinessIds = await prisma.businessUser.findMany({
    where: { userId: params.id, role: 'OWNER' },
    select: { businessId: true },
  })
  for (const { businessId } of ownedBusinessIds) {
    const otherOwners = await prisma.businessUser.count({
      where: { businessId, role: 'OWNER', userId: { not: params.id } },
    })
    if (otherOwners === 0) {
      await prisma.business.delete({ where: { id: businessId } })
    }
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
