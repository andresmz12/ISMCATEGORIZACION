// Transaction dates across this app are stored anchored at noon local time
// (see plaid/sync, import) to avoid UTC-midnight rounding shifting a date by
// a day. Date-range filters must match that anchor, or the last day of any
// range silently drops every transaction dated on it.

export function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`)
}

export function noon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

// Safely parses a transaction date coming from an API request body, which may
// be a bare "YYYY-MM-DD" (needs the noon anchor applied) or an already
// time-anchored ISO datetime string (must be parsed as-is, not re-anchored,
// or the real stored instant would shift). A bare date parsed directly with
// `new Date()` is UTC midnight, which silently displays one day earlier for
// any user west of UTC — this is what actually anchors it correctly either way.
export function parseTransactionDate(input: string): Date | null {
  const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(input) ? noon(input) : new Date(input)
  return isNaN(bareDate.getTime()) ? null : bareDate
}
