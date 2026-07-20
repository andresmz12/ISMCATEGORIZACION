import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { PLAN_LIMITS as LIMITS } from './plan-config'

export type PlanFeature = 'aiClassify' | 'receiptScan' | 'reports' | 'plaid' | 'team'

const FEATURE_MESSAGES: Record<PlanFeature, string> = {
  aiClassify:  'La clasificación con IA requiere plan PLUS, ENTERPRISE o CUSTOM',
  receiptScan: 'El escaneo de recibos requiere plan PLUS, ENTERPRISE o CUSTOM',
  reports:     'Los reportes requieren plan PLUS, ENTERPRISE o CUSTOM',
  plaid:       'La conexión bancaria requiere plan PLUS, ENTERPRISE o CUSTOM',
  team:        'La gestión de equipo requiere plan PLUS, ENTERPRISE o CUSTOM',
}

export function getPlanLimits(plan: string) {
  return LIMITS[plan as keyof typeof LIMITS] ?? LIMITS.BASIC
}

export function requirePlanFeature(session: any, feature: PlanFeature): NextResponse | null {
  const accountType = session?.user?.accountType
  const plan = session?.user?.plan
  if (accountType === 'SUPERADMIN') return null
  if (!getPlanLimits(plan)[feature]) {
    return NextResponse.json({ error: FEATURE_MESSAGES[feature] }, { status: 403 })
  }
  return null
}

// Businesses are owned by an account, not by an individual User — count
// across every user that shares the account so the limit reflects what the
// whole team (owner + invited members) has created, not just the caller.
export async function countOwnedBusinesses(accountId: string): Promise<number> {
  const result = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::integer as count
    FROM "BusinessUser" bu
    INNER JOIN "User" u ON u.id = bu."userId"
    WHERE u."accountId" = ${accountId} AND bu.role = 'OWNER'
  `
  return result[0].count
}
