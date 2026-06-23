interface RLRecord { count: number; resetAt: number }
const store = new Map<string, RLRecord>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  const rec = store.get(key)

  if (!rec || now > rec.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    if (store.size > 50_000) {
      for (const [k, v] of store) {
        if (now > v.resetAt) store.delete(k)
      }
    }
    return { ok: true, remaining: limit - 1 }
  }

  if (rec.count >= limit) return { ok: false, remaining: 0 }
  rec.count++
  return { ok: true, remaining: limit - rec.count }
}

export function rateLimitResponse() {
  return Response.json(
    { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  )
}
