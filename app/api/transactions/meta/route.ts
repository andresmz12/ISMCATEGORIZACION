import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'

// Distinct vendor/cost-center strings this business has already used, for the
// add/edit-transaction datalists — lets the user pick a previous one or type
// a brand new value, without a separate Vendor/CostCenter catalog to manage.
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

  const [vendors, costCenters] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, vendor: { not: null } },
      distinct: ['vendor'],
      select: { vendor: true },
      orderBy: { vendor: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { businessId, costCenter: { not: null } },
      distinct: ['costCenter'],
      select: { costCenter: true },
      orderBy: { costCenter: 'asc' },
    }),
  ])

  return NextResponse.json({
    vendors: vendors.map(v => v.vendor).filter(Boolean),
    costCenters: costCenters.map(c => c.costCenter).filter(Boolean),
  })
}
