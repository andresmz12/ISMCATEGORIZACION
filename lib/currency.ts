export type CurrencyCode = 'USD' | 'COP'

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  USD: 'en-US',
  COP: 'es-CO',
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const code = (currency === 'COP' ? 'COP' : 'USD') as CurrencyCode
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[code], { style: 'currency', currency: code }).format(amount)
}

// ExcelJS numFmt code strings (currency symbol prefix; COP conventionally shown with no decimals)
export function excelNumFmt(currency?: string): string {
  return currency === 'COP' ? '"$"#,##0' : '"$"#,##0.00'
}
