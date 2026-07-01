const LIMITS = {
  BASIC:      { businesses: 1,        aiClassify: false, receiptScan: false, reports: false, plaid: false, team: false },
  PLUS:       { businesses: 5,        aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
  ENTERPRISE: { businesses: 20,       aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
  CUSTOM:     { businesses: Infinity, aiClassify: true,  receiptScan: true,  reports: true,  plaid: true,  team: true  },
}

export function getPlanLimits(plan: string) {
  return LIMITS[plan as keyof typeof LIMITS] ?? LIMITS.BASIC
}
