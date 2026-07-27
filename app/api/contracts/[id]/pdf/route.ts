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

// Streams the PDF same-origin so the admin panel can show it in an <iframe>
// without exposing where/how the bytes are actually stored.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    select: { pdfData: true, finalPdfData: true, status: true },
  })
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const base64 = contract.status === 'COMPLETED' ? contract.finalPdfData : contract.pdfData
  if (!base64) return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 })

  return new NextResponse(Buffer.from(base64, 'base64'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contrato-${params.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
