import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { CountryCode, Products } from 'plaid'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const plan = (session.user as any).plan
  const accountType = (session.user as any).accountType

  if (plan === 'BASIC' && accountType !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Requiere plan PLUS o ENTERPRISE' }, { status: 403 })
  }

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json({ error: 'Plaid no está configurado' }, { status: 503 })
  }

  const { businessId } = await req.json()
  if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'ISM Categorización',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'es',
    })
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (e: any) {
    console.error('plaid link-token error:', e?.response?.data || e)
    return NextResponse.json({ error: 'Error al crear link token' }, { status: 500 })
  }
}
