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
