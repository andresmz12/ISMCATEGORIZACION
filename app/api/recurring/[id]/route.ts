import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

// Pause/resume only — editing amount/frequency/category of a live template
// is deliberately not supported here: past materialized transactions must
// never retroactively change, and a template mid-series has no clean way to
// distinguish "this edit applies going forward" from a silent history
// rewrite. To change the terms, cancel this template and create a new one.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { active } = await req.json()
  if (typeof active !== 'boolean') return NextResponse.json({ error: 'active (boolean) required' }, { status: 400 })

  const template = await prisma.recurringTransaction.findUnique({ where: { id: params.id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessWriteAccess(userId, template.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.recurringTransaction.update({
    where: { id: params.id },
    data: { active },
    include: { category: true },
  })
  await logAudit({ userId, businessId: template.businessId, action: active ? 'RESUME_RECURRING' : 'PAUSE_RECURRING', entity: 'RecurringTransaction', entityId: params.id })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const template = await prisma.recurringTransaction.findUnique({ where: { id: params.id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBusinessWriteAccess(userId, template.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Transaction.recurringId is onDelete: SetNull — deleting the template
  // never deletes the transactions it already created.
  await prisma.recurringTransaction.delete({ where: { id: params.id } })
  await logAudit({ userId, businessId: template.businessId, action: 'DELETE_RECURRING', entity: 'RecurringTransaction', entityId: params.id })
  return NextResponse.json({ deleted: params.id })
}
