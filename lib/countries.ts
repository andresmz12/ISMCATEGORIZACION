// Per-country defaults for the Business form: which currency a new business
// starts with, which entity types it can pick from, and what its tax-id field
// is called locally. Business.country itself is the only thing that's
// authoritative — these are just UI/seed defaults keyed off it.
export type BusinessCountry = 'US' | 'CO'

export const COUNTRIES: { value: BusinessCountry; label: string }[] = [
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CO', label: 'Colombia' },
]

export const DEFAULT_CURRENCY: Record<BusinessCountry, 'USD' | 'COP'> = {
  US: 'USD',
  CO: 'COP',
}

export const ENTITY_TYPES: Record<BusinessCountry, string[]> = {
  US: ['Sole Proprietor (Schedule C)', 'S-Corp', 'C-Corp', 'Partnership', 'LLC'],
  CO: ['Persona Natural', 'SAS', 'S.A.', 'Ltda.', 'Empresa Unipersonal'],
}

export const TAX_ID_LABEL: Record<BusinessCountry, string> = {
  US: 'EIN / Tax ID',
  CO: 'NIT',
}

export function isBusinessCountry(v: unknown): v is BusinessCountry {
  return v === 'US' || v === 'CO'
}

// Just suggestions for the bank-name field on import (free text either way) —
// shown as a datalist and used for the input's placeholder example.
export const COMMON_BANKS: Record<BusinessCountry, string[]> = {
  US: ['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'TD Bank', 'Capital One'],
  CO: ['Bancolombia', 'Davivienda', 'BBVA Colombia', 'Banco de Bogotá', 'Banco Popular', 'Nequi', 'Daviplata'],
}
