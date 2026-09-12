import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'

// The vendor catalog holds the details that belong to the vendor rather than to
// each transaction — today just the NIT, which a Colombian certificado de
// retención has to name the tercero by. Transaction.vendor stays free text and
// is matched to this catalog by name.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const vendors = await prisma.vendor.findMany({ where: { businessId }, orderBy: { name: 'asc' } })
  return NextResponse.json(vendors)
}

// Upsert by (businessId, name): saving a NIT for a vendor name that has no
// catalog row yet creates it, and clearing the NIT on an existing one blanks
// the field rather than deleting the row.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const { businessId, name, nit } = await req.json()
  if (!businessId || !name) return NextResponse.json({ error: 'businessId and name required' }, { status: 400 })
  if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const trimmedName = String(name).trim()
  const trimmedNit = nit ? String(nit).trim() : null
  if (!trimmedName) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (trimmedName.length > 100) return NextResponse.json({ error: 'Vendor name too long' }, { status: 400 })
  if (trimmedNit && trimmedNit.length > 30) return NextResponse.json({ error: 'NIT too long' }, { status: 400 })

  const vendor = await prisma.vendor.upsert({
    where: { businessId_name: { businessId, name: trimmedName } },
    update: { nit: trimmedNit },
    create: { businessId, name: trimmedName, nit: trimmedNit },
  })
  return NextResponse.json(vendor)
}
