import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public — streamed same-origin so the client's browser can show the draft
// in an <iframe> without exposing storage internals, matching the admin
// PDF route's behavior.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const contract = await prisma.contract.findUnique({
    where: { signToken: params.token },
    select: { pdfData: true, finalPdfData: true, status: true },
  })
  if (!contract) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })

  const base64 = contract.status === 'COMPLETED' ? contract.finalPdfData : contract.pdfData
  if (!base64) return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 })

  const filename = contract.status === 'COMPLETED' ? 'Contrato Firmado - My Profit and Loss.pdf' : 'Contrato - My Profit and Loss.pdf'

  return new NextResponse(Buffer.from(base64, 'base64'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
