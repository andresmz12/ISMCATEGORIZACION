import { NextResponse } from 'next/server'

const LIMITS = {
  BASIC:      { businesses: 1,        aiClassify: false, receiptScan: false, reports: true,  plaid: false, team: false },
  PLUS:       { businesses: 5,        aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
  ENTERPRISE: { businesses: 20,       aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
  CUSTOM:     { businesses: Infinity, aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
}

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
