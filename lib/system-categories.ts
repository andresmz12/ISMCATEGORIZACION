// Single source of truth for the built-in (isSystem) categories, shared by the
// dev seed (prisma/seed.ts) and the production bootstrap endpoint
// (app/api/setup/route.ts) so the two never drift apart.
//
// `country: null` means the category is shown to every business regardless of
// country (e.g. generic bookkeeping buckets); `'US'`/`'CO'` restricts it to
// businesses with that Business.country. `irsCode` holds whatever tax/chart-of-
// accounts reference makes sense for that country — a Schedule C line for US
// businesses, a PUC (Plan Único de Cuentas) account group for Colombian ones.
export type SystemCategorySeed = {
  name: string
  irsCode: string
  country: 'US' | 'CO' | null
}

export const SYSTEM_CATEGORIES: SystemCategorySeed[] = [
  // United States — Schedule C
  { name: 'Advertising', irsCode: 'Schedule C Line 8', country: 'US' },
  { name: 'Car & Truck Expenses', irsCode: 'Schedule C Line 9', country: 'US' },
  { name: 'Commissions & Fees', irsCode: 'Schedule C Line 10', country: 'US' },
  { name: 'Contract Labor', irsCode: 'Schedule C Line 11', country: 'US' },
  { name: 'Insurance', irsCode: 'Schedule C Line 15', country: 'US' },
  { name: 'Interest - Other', irsCode: 'Schedule C Line 16b', country: 'US' },
  { name: 'Legal & Professional', irsCode: 'Schedule C Line 17', country: 'US' },
  { name: 'Office Expenses', irsCode: 'Schedule C Line 18', country: 'US' },
  { name: 'Rent - Other', irsCode: 'Schedule C Line 20b', country: 'US' },
  { name: 'Repairs & Maintenance', irsCode: 'Schedule C Line 21', country: 'US' },
  { name: 'Supplies', irsCode: 'Schedule C Line 22', country: 'US' },
  { name: 'Taxes & Licenses', irsCode: 'Schedule C Line 23', country: 'US' },
  { name: 'Travel', irsCode: 'Schedule C Line 24a', country: 'US' },
  { name: 'Meals (50%)', irsCode: 'Schedule C Line 24b', country: 'US' },
  { name: 'Utilities', irsCode: 'Schedule C Line 25', country: 'US' },
  { name: 'Wages', irsCode: 'Schedule C Line 26', country: 'US' },
  { name: 'Other Expenses', irsCode: 'Schedule C Line 27a', country: 'US' },
  { name: 'Cost of Goods Sold', irsCode: 'Schedule C Part III', country: 'US' },
  { name: 'Business Income', irsCode: 'Schedule C Line 1', country: 'US' },
  { name: 'Owner Draw / Personal', irsCode: 'Non-Deductible', country: 'US' },

  // Colombia — PUC (Plan Único de Cuentas)
  { name: 'Publicidad y Mercadeo', irsCode: 'PUC 5195', country: 'CO' },
  { name: 'Vehículos y Transporte', irsCode: 'PUC 5135', country: 'CO' },
  { name: 'Comisiones', irsCode: 'PUC 5110', country: 'CO' },
  { name: 'Honorarios', irsCode: 'PUC 5110', country: 'CO' },
  { name: 'Seguros', irsCode: 'PUC 5130', country: 'CO' },
  { name: 'Gastos Financieros e Intereses', irsCode: 'PUC 5305', country: 'CO' },
  { name: 'Servicios Legales y Contables', irsCode: 'PUC 5140', country: 'CO' },
  { name: 'Gastos de Oficina', irsCode: 'PUC 5195', country: 'CO' },
  { name: 'Arrendamientos', irsCode: 'PUC 5120', country: 'CO' },
  { name: 'Mantenimiento y Reparaciones', irsCode: 'PUC 5145', country: 'CO' },
  { name: 'Suministros', irsCode: 'PUC 5195', country: 'CO' },
  { name: 'Impuestos y Tasas', irsCode: 'PUC 5115', country: 'CO' },
  { name: 'Viajes', irsCode: 'PUC 5155', country: 'CO' },
  { name: 'Alimentación (50% deducible)', irsCode: 'PUC 5195', country: 'CO' },
  { name: 'Servicios Públicos', irsCode: 'PUC 5135', country: 'CO' },
  { name: 'Nómina y Prestaciones Sociales', irsCode: 'PUC 5105', country: 'CO' },
  { name: 'Otros Gastos', irsCode: 'PUC 5195', country: 'CO' },
  { name: 'Costo de Ventas', irsCode: 'PUC 61', country: 'CO' },
  { name: 'Ingresos Operacionales', irsCode: 'PUC 4135', country: 'CO' },
  { name: 'Retiro de Socios', irsCode: 'No deducible', country: 'CO' },

  // Shared — same bucket regardless of the business's country
  { name: 'Transfer', irsCode: 'Non-Deductible', country: null },
  { name: 'Uncategorized', irsCode: 'Unclassified', country: null },
]

export function systemCategoryId(name: string): string {
  return `sys_${name.replace(/[\s/&()]+/g, '_').toLowerCase()}`
}
