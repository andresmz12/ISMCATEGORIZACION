import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { getClassifiedCount } from '@/lib/ai-budget'

// Read-only usage summary for the business's own users — transaction count only,
// never cost. Cost/budget management is superadmin-only (see /api/admin/businesses).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  if (!await checkBusinessAccess(userId, params.id, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const usage = await getClassifiedCount(params.id)
  return NextResponse.json(usage)
}
