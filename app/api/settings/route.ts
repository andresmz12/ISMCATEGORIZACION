import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, firmName, currentPassword, newPassword } = body

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updates: Record<string, any> = {}

  if (name !== undefined) {
    if (!name || name.trim().length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 })
    if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })
    updates.name = name.trim()
  }

  // The firm name lives on the shared BillingAccount now — only the account
  // owner can rename it, since it's visible to every invited team member too.
  if (firmName !== undefined && user.accountRole === 'OWNER') {
    await prisma.billingAccount.update({
      where: { id: user.accountId },
      data: { name: firmName?.trim()?.slice(0, 100) || null },
    })
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })
    const pwError = validatePassword(newPassword)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })
    updates.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  if (Object.keys(updates).length === 0 && firmName === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = Object.keys(updates).length > 0
    ? await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: { id: true, name: true, email: true, accountType: true, billingAccount: { select: { plan: true, name: true } } },
      })
    : await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, email: true, accountType: true, billingAccount: { select: { plan: true, name: true } } },
      })

  const changedFields = [...Object.keys(updates), ...(firmName !== undefined ? ['firmName'] : [])]
  await logAudit({ userId, action: 'UPDATE_SETTINGS', entity: 'User', entityId: userId, metadata: { fields: changedFields } })
  return NextResponse.json({ ...updated, plan: updated.billingAccount.plan, firmName: updated.billingAccount.name, billingAccount: undefined })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, accountType: true, accountRole: true, createdAt: true, lastLogin: true,
      billingAccount: { select: { plan: true, name: true, subscriptionStatus: true, squareSubscriptionId: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { billingAccount, ...rest } = user
  return NextResponse.json({
    ...rest,
    plan: billingAccount.plan,
    firmName: billingAccount.name,
    subscriptionStatus: billingAccount.subscriptionStatus,
    hasSubscription: !!billingAccount.squareSubscriptionId,
  })
}
