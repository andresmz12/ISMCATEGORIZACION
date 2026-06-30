import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendAssignmentEmail } from '@/lib/email'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: { business: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
  })
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: assignment.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Viewers can only update status of assignments assigned to them
  if (bu?.role === 'VIEWER') {
    if (assignment.assignedToId !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para editar esta asignación' }, { status: 403 })
    }
    const allowedKeys = new Set(['status'])
    const hasOtherKeys = Object.keys(body).some(k => !allowedKeys.has(k))
    if (hasOtherKeys) {
      return NextResponse.json({ error: 'Solo puedes cambiar el estado de tus asignaciones' }, { status: 403 })
    }
  }
  const data: any = {}
  if (body.title !== undefined) data.title = body.title.trim()
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.status !== undefined && ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(body.status)) {
    data.status = body.status
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null

  const prevAssignedToId = assignment.assignedToId
  if (body.assignedToId !== undefined) {
    if (body.assignedToId) {
      const targetBu = await prisma.businessUser.findUnique({
        where: { userId_businessId: { userId: body.assignedToId, businessId: assignment.businessId } },
      })
      if (!targetBu) return NextResponse.json({ error: 'El usuario no pertenece a este negocio' }, { status: 400 })
    }
    data.assignedToId = body.assignedToId || null
  }

  const updated = await prisma.assignment.update({
    where: { id: params.id },
    data,
    include: {
      business: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      notes: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  await logAudit({ userId: userId, businessId: assignment.businessId, action: 'UPDATE_ASSIGNMENT', entity: 'Assignment', entityId: params.id })

  // Send email if assignee changed
  if (
    data.assignedToId &&
    data.assignedToId !== prevAssignedToId &&
    updated.assignedTo?.email &&
    data.assignedToId !== userId
  ) {
    sendAssignmentEmail({
      to: updated.assignedTo.email,
      assigneeName: updated.assignedTo.name || updated.assignedTo.email,
      assignerName: updated.createdBy.name || updated.createdBy.email,
      businessName: updated.business.name,
      title: updated.title,
      description: updated.description,
      dueDate: updated.dueDate,
      isReassignment: true,
    }).catch(err => console.error('[email] assignment notification failed:', err))
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignment = await prisma.assignment.findUnique({ where: { id: params.id } })
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as any).id
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: assignment.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (bu?.role === 'VIEWER') {
    return NextResponse.json({ error: 'No tienes permiso para eliminar asignaciones' }, { status: 403 })
  }

  await prisma.assignment.delete({ where: { id: params.id } })
  await logAudit({ userId: userId, businessId: assignment.businessId, action: 'DELETE_ASSIGNMENT', entity: 'Assignment', entityId: params.id })
  return NextResponse.json({ ok: true })
}
