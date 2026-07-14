import crypto from 'crypto'

// Encrypts secrets at rest (Plaid access tokens) with AES-256-GCM. The key is
// derived by hashing PLAID_TOKEN_ENCRYPTION_KEY so any string length works.
// Encrypted values are prefixed "enc:v1:" so decrypt() can tell them apart
// from tokens stored before this was added, without needing a data migration.
const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const secret = process.env.PLAID_TOKEN_ENCRYPTION_KEY
  if (!secret) return null
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  if (!key) {
    console.warn('[crypto] PLAID_TOKEN_ENCRYPTION_KEY not set — storing secret unencrypted')
    return plaintext
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext value, stored before encryption was added
  const key = getKey()
  if (!key) {
    throw new Error('PLAID_TOKEN_ENCRYPTION_KEY is not set but an encrypted secret was found — cannot decrypt')
  }
  const [ivHex, authTagHex, ciphertextHex] = stored.slice(PREFIX.length).split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8')
}
