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
  // Typical retención en la fuente rate withheld on payments in this
  // category — only meaningful for country: 'CO' rows. Sourced from the
  // 2026 retention table (honorarios/comisiones 11%, servicios 4%,
  // arrendamiento de inmuebles 3.5%, compras 2.5%). Reference only, not tax
  // advice: the real rate depends on who's being paid (declarante/no
  // declarante, persona natural/jurídica) and the payment vs. the UVT
  // minimum base. 'N/A' where no single typical rate applies (payroll runs
  // its own withholding table, accounting entries like depreciation aren't
  // payments, income categories are what OTHERS withhold from this
  // business, not a rate it applies itself).
  retefuente?: string
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
  //
  // No category name bakes in a fixed deductibility % (e.g. "Alimentación
  // (50% deducible)", removed — that copied the US "Meals (50%)" rule by
  // analogy, but Colombia has no such blanket rule; deductibility under
  // Estatuto Tributario Art. 107 is a necessity/causality/proportionality
  // test decided per expense). Deductibility is a per-transaction field
  // (YES/NO/FIFTY) the accountant sets on each transaction, independent of
  // its category.
  //
  // irsCode also cites the Formulario 110 casilla (62 Costos, 63 Gastos de
  // administración, 64 Gastos de distribución y ventas, 65 Gastos
  // financieros, 66 Otros gastos y deducciones) each PUC subcuenta rolls up
  // to when filing renta — the real Estatuto Tributario/DIAN structure is
  // only these 5 broad buckets, so this is how each detailed bookkeeping
  // category traces back to the actual tax return line, the same way a US
  // category cites its Schedule C line.
  { name: 'Nómina y Prestaciones Sociales', irsCode: 'PUC 5105 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A — tabla de retención salarial propia' },
  { name: 'Honorarios', irsCode: 'PUC 5110 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '11%' },
  { name: 'Comisiones', irsCode: 'PUC 5110 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '11%' },
  { name: 'Impuestos y Tasas', irsCode: 'PUC 5115 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A' },
  { name: 'Industria y Comercio (ICA)', irsCode: 'PUC 5115 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A — varía por municipio (2-10 x mil)' },
  { name: 'Arrendamientos', irsCode: 'PUC 5120 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: '3.5%' },
  { name: 'Contribuciones y Afiliaciones', irsCode: 'PUC 5125 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A' },
  { name: 'Seguros', irsCode: 'PUC 5130 · F.110 Casilla 63', country: 'CO', vatRate: 'Exento', retefuente: 'N/A' },
  { name: 'Servicios Públicos', irsCode: 'PUC 5135 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A' },
  { name: 'Vehículos y Transporte', irsCode: 'PUC 5135 · F.110 Casilla 64', country: 'CO', vatRate: '19%', retefuente: 'N/A — depende del concepto' },
  { name: 'Servicios Legales y Contables', irsCode: 'PUC 5140 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '11%' },
  { name: 'Mantenimiento y Reparaciones', irsCode: 'PUC 5145 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '4%' },
  { name: 'Adecuación e Instalación', irsCode: 'PUC 5150 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '4%' },
  { name: 'Viajes', irsCode: 'PUC 5155 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: 'N/A' },
  { name: 'Depreciación de Activos', irsCode: 'PUC 5160 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A — no es un pago' },
  { name: 'Amortizaciones', irsCode: 'PUC 5165 · F.110 Casilla 63', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A — no es un pago' },
  { name: 'Publicidad y Mercadeo', irsCode: 'PUC 5195 · F.110 Casilla 64', country: 'CO', vatRate: '19%', retefuente: '4%' },
  { name: 'Gastos de Oficina', irsCode: 'PUC 5195 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '2.5%' },
  { name: 'Suministros', irsCode: 'PUC 5195 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: '2.5%' },
  { name: 'Alimentación', irsCode: 'PUC 5195 · F.110 Casilla 63', country: 'CO', vatRate: '19%', retefuente: 'N/A' },
  { name: 'Otros Gastos', irsCode: 'PUC 5195 · F.110 Casilla 66', country: 'CO', vatRate: '19%', retefuente: 'N/A' },
  { name: 'Gastos Financieros e Intereses', irsCode: 'PUC 5305 · F.110 Casilla 65', country: 'CO', vatRate: 'Exento', retefuente: 'N/A' },
  { name: 'Impuesto de Renta', irsCode: 'PUC 5405 — no es un costo/deducción, es el impuesto mismo', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A' },
  { name: 'Costo de Ventas', irsCode: 'PUC 61 · F.110 Casilla 62', country: 'CO', vatRate: '19%', retefuente: '2.5%' },
  { name: 'Ingresos Operacionales', irsCode: 'PUC 4135 — ingresos, no costos/deducciones', country: 'CO', retefuente: 'N/A — lo retienen terceros a este negocio' },
  { name: 'Ingresos No Operacionales', irsCode: 'PUC 42 — ingresos, no costos/deducciones', country: 'CO', retefuente: 'N/A — lo retienen terceros a este negocio' },
  { name: 'Retiro de Socios', irsCode: 'No deducible — movimiento de patrimonio, no P&L', country: 'CO', vatRate: 'Excluido', retefuente: 'N/A' },

  // Transfer / Uncategorized exist for every business, but the label must
  // match the business's own language — a Colombian business should never
  // see English category names in its dropdowns. Same bucket, one pair of
  // rows per country instead of a single shared (country: null) row.
  { name: 'Transfer', irsCode: 'Non-Deductible', country: 'US' },
  { name: 'Uncategorized', irsCode: 'Unclassified', country: 'US' },
  { name: 'Transferencia', irsCode: 'No deducible', country: 'CO' },
  { name: 'Sin Categorizar', irsCode: 'Sin clasificar', country: 'CO' },
]

export function systemCategoryId(name: string): string {
  return `sys_${name.replace(/[\s/&()]+/g, '_').toLowerCase()}`
}
