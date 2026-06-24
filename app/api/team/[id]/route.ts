import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/validate'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // Team management disabled for now
  return NextResponse.json({ error: 'Team features temporarily disabled' }, { status: 503 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  // Team management disabled for now
  return NextResponse.json({ error: 'Team features temporarily disabled' }, { status: 503 })
}
