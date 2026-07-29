export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula'
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número'
  return null
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export function sanitizeString(s: string, maxLen = 500): string {
  return String(s).trim().slice(0, maxLen)
}

// The app sits behind exactly one trusted reverse proxy (Railway's edge —
// see next.config.js's railway.app host check). That proxy appends the real
// connecting IP as the LAST entry of X-Forwarded-For; every entry before it
// is whatever the client itself sent and is fully attacker-controlled. Using
// the first entry (as a naive "client IP" read would) lets anyone bypass
// IP-keyed rate limits by sending a different self-chosen value each request.
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}
