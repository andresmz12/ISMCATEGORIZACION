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

export const INDUSTRIES: Record<BusinessCountry, string[]> = {
  US: [
    'Food Service & Restaurants', 'Retail Trade', 'Professional Services',
    'Healthcare', 'Construction', 'Manufacturing', 'Technology',
    'Real Estate', 'Transportation', 'Other',
  ],
  CO: [
    'Alimentos y Restaurantes', 'Comercio Minorista', 'Servicios Profesionales',
    'Salud', 'Construcción', 'Manufactura', 'Tecnología',
    'Bienes Raíces', 'Transporte', 'Otro',
  ],
}

// Example document types shown as a hint on the Documentos page — just
// copy, since document types themselves are user-created free text either way.
export const DOCUMENT_TYPE_EXAMPLES: Record<BusinessCountry, string> = {
  US: 'W-2, 1099, Estado de cuenta',
  CO: 'RUT, Cámara de Comercio, Certificado de Ingresos y Retenciones',
}

export const TAX_ID_LABEL: Record<BusinessCountry, string> = {
  US: 'EIN / Tax ID',
  CO: 'NIT',
}

export function isBusinessCountry(v: unknown): v is BusinessCountry {
  return v === 'US' || v === 'CO'
}

// Colombia-only classification picked at registration (see the ClientType
// enum in schema.prisma). PERSONA_NATURAL can never use the team feature,
// regardless of plan; PERSONA_JURIDICA and CONTADOR follow the normal
// plan-based gating.
export type ClientType = 'PERSONA_NATURAL' | 'PERSONA_JURIDICA' | 'CONTADOR'

export const CLIENT_TYPES: { value: ClientType; label: string; description: string }[] = [
  { value: 'PERSONA_NATURAL', label: 'Persona Natural', description: 'Trabajas por tu cuenta — sin equipo, solo tú.' },
  { value: 'PERSONA_JURIDICA', label: 'Persona Jurídica', description: 'Una empresa — puedes invitar a tu equipo.' },
  { value: 'CONTADOR', label: 'Contador', description: 'Llevas la contabilidad de otros negocios — puedes invitar a tu equipo.' },
]

export function isClientType(v: unknown): v is ClientType {
  return v === 'PERSONA_NATURAL' || v === 'PERSONA_JURIDICA' || v === 'CONTADOR'
}

// Just suggestions for the bank-name field on import (free text either way) —
// shown as a datalist and used for the input's placeholder example.
export const COMMON_BANKS: Record<BusinessCountry, string[]> = {
  US: ['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'TD Bank', 'Capital One'],
  CO: ['Bancolombia', 'Davivienda', 'BBVA Colombia', 'Banco de Bogotá', 'Banco Popular', 'Nequi', 'Daviplata'],
}
