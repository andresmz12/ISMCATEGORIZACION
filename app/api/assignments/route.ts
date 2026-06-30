import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { sendAssignmentEmail } from '@/lib/email'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const where: any = businessId
    ? { businessId }
    : { OR: [{ createdById: userId }, { assignedToId: userId }] }

  if (businessId && !(await checkBusinessAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      business: { select: { name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      notes: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(assignments)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { businessId, title, description, assignedToId, dueDate } = body

  if (!businessId || !title?.trim()) {
    return NextResponse.json({ error: 'businessId y title son requeridos' }, { status: 400 })
  }

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  if (!(await checkBusinessAccess(userId, businessId, accountType))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Viewers cannot create assignments
  const callerBu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
  })
  if (callerBu?.role === 'VIEWER') {
    return NextResponse.json({ error: 'No tienes permiso para crear asignaciones' }, { status: 403 })
  }

  // Validate assignedToId belongs to the same business
  if (assignedToId) {
    const bu = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId: assignedToId, businessId } },
    })
    if (!bu) return NextResponse.json({ error: 'El usuario asignado no pertenece a este negocio' }, { status: 400 })
  }

  const assignment = await prisma.assignment.create({
    data: {
      businessId,
      title: title.trim(),
      description: description?.trim() || null,
      assignedToId: assignedToId || null,
      createdById: userId,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: {
      business: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  await logAudit({ userId: userId, businessId: businessId, action: 'CREATE_ASSIGNMENT', entity: 'Assignment', entityId: assignment.id, metadata: { assignedToId } })

  // Send email notification to assigned user
  if (assignment.assignedTo && assignment.assignedTo.email && assignedToId !== userId) {
    sendAssignmentEmail({
      to: assignment.assignedTo.email,
      assigneeName: assignment.assignedTo.name || assignment.assignedTo.email,
      assignerName: assignment.createdBy.name || assignment.createdBy.email,
      businessName: assignment.business.name,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
    }).catch(err => {
      const detail = err?.response?.body || err?.message || err
      console.error('[email] assignment notification failed:', JSON.stringify(detail))
    })
  }

  return NextResponse.json(assignment, { status: 201 })
}
