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
  // Typical VAT/IVA rate this category's expenses carry in Colombia — only
  // meaningful for country: 'CO' rows. These are reasonable defaults, not
  // tax advice: the real rate depends on the specific good/service and
  // should be corrected per category from the superadmin screen when it
  // doesn't match what the accountant actually files.
  vatRate?: string
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

  // Colombia — PUC (Plan Único de Cuentas), grupos 51/52 (gastos operacionales
  // de administración/ventas), 53 (no operacionales), 42 (ingresos no
  // operacionales), 54 (impuesto de renta) y 61 (costo de ventas), tal como
  // los define el Decreto 2650 de 1993. + tarifa de IVA típica.
  { name: 'Nómina y Prestaciones Sociales', irsCode: 'PUC 5105', country: 'CO', vatRate: 'Excluido' },
  { name: 'Honorarios', irsCode: 'PUC 5110', country: 'CO', vatRate: '19%' },
  { name: 'Comisiones', irsCode: 'PUC 5110', country: 'CO', vatRate: '19%' },
  { name: 'Impuestos y Tasas', irsCode: 'PUC 5115', country: 'CO', vatRate: 'Excluido' },
  { name: 'Arrendamientos', irsCode: 'PUC 5120', country: 'CO', vatRate: 'Excluido' },
  { name: 'Contribuciones y Afiliaciones', irsCode: 'PUC 5125', country: 'CO', vatRate: 'Excluido' },
  { name: 'Seguros', irsCode: 'PUC 5130', country: 'CO', vatRate: 'Exento' },
  { name: 'Servicios Públicos', irsCode: 'PUC 5135', country: 'CO', vatRate: 'Excluido' },
  { name: 'Vehículos y Transporte', irsCode: 'PUC 5135', country: 'CO', vatRate: '19%' },
  { name: 'Servicios Legales y Contables', irsCode: 'PUC 5140', country: 'CO', vatRate: '19%' },
  { name: 'Mantenimiento y Reparaciones', irsCode: 'PUC 5145', country: 'CO', vatRate: '19%' },
  { name: 'Adecuación e Instalación', irsCode: 'PUC 5150', country: 'CO', vatRate: '19%' },
  { name: 'Viajes', irsCode: 'PUC 5155', country: 'CO', vatRate: '19%' },
  { name: 'Depreciación de Activos', irsCode: 'PUC 5160', country: 'CO', vatRate: 'Excluido' },
  { name: 'Amortizaciones', irsCode: 'PUC 5165', country: 'CO', vatRate: 'Excluido' },
  { name: 'Publicidad y Mercadeo', irsCode: 'PUC 5195', country: 'CO', vatRate: '19%' },
  { name: 'Gastos de Oficina', irsCode: 'PUC 5195', country: 'CO', vatRate: '19%' },
  { name: 'Suministros', irsCode: 'PUC 5195', country: 'CO', vatRate: '19%' },
  { name: 'Alimentación (50% deducible)', irsCode: 'PUC 5195', country: 'CO', vatRate: '19%' },
  { name: 'Otros Gastos', irsCode: 'PUC 5195', country: 'CO', vatRate: '19%' },
  { name: 'Gastos Financieros e Intereses', irsCode: 'PUC 5305', country: 'CO', vatRate: 'Exento' },
  { name: 'Impuesto de Renta', irsCode: 'PUC 5405', country: 'CO', vatRate: 'Excluido' },
  { name: 'Costo de Ventas', irsCode: 'PUC 61', country: 'CO', vatRate: '19%' },
  { name: 'Ingresos Operacionales', irsCode: 'PUC 4135', country: 'CO' },
  { name: 'Ingresos No Operacionales', irsCode: 'PUC 42', country: 'CO' },
  { name: 'Retiro de Socios', irsCode: 'No deducible', country: 'CO', vatRate: 'Excluido' },

  // Shared — same bucket regardless of the business's country
  { name: 'Transfer', irsCode: 'Non-Deductible', country: null },
  { name: 'Uncategorized', irsCode: 'Unclassified', country: null },
]

export function systemCategoryId(name: string): string {
  return `sys_${name.replace(/[\s/&()]+/g, '_').toLowerCase()}`
}
