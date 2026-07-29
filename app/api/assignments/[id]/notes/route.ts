import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const assignment = await prisma.assignment.findUnique({ where: { id: params.id } })
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: assignment.businessId } },
  })
  if (!bu && (session.user as any).accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { note } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 })
  if (note.length > 2000) return NextResponse.json({ error: 'Note too long (max 2000 chars)' }, { status: 400 })

  const created = await prisma.assignmentNote.create({
    data: { assignmentId: params.id, userId, note: note.trim() },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const noteId = searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const note = await prisma.assignmentNote.findUnique({
    where: { id: noteId },
    include: { assignment: { select: { businessId: true } } },
  })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const accountType = (session.user as any).accountType
  if (note.userId !== userId && accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Only the author can delete a note' }, { status: 403 })
  }
  // Authorship alone isn't enough — the author may since have lost access to
  // the note's business (removed from the team) and must not retain the
  // ability to delete historical notes there.
  if (!await checkBusinessAccess(userId, note.assignment.businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.assignmentNote.delete({ where: { id: noteId } })
  return NextResponse.json({ ok: true })
}
