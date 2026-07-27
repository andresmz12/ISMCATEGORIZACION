import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireSuperadmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).accountType !== 'SUPERADMIN') return null
  return session
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      stores: true,
      createdBy: { select: { name: true, email: true } },
      providerSignedBy: { select: { name: true, email: true } },
    },
  })
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { pdfData, finalPdfData, clientSignature, providerSignature, ...rest } = contract
  return NextResponse.json({
    ...rest,
    hasDraftPdf: !!pdfData,
    hasFinalPdf: !!finalPdfData,
    hasClientSignature: !!clientSignature,
    hasProviderSignature: !!providerSignature,
  })
}
