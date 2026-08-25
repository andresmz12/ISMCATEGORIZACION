export const PLAN_LIMITS = {
  NONE:       { businesses: 0,        aiClassify: false, receiptScan: false, reports: false, team: false },
  BASIC:      { businesses: 1,        aiClassify: false, receiptScan: false, reports: true,  team: false },
  PLUS:       { businesses: 5,        aiClassify: true,  receiptScan: true,  reports: true,  team: true  },
  ENTERPRISE: { businesses: 20,       aiClassify: true,  receiptScan: true,  reports: true,  team: true  },
  CUSTOM:     { businesses: Infinity, aiClassify: true,  receiptScan: true,  reports: true,  team: true  },
} as const
