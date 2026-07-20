import { SquareClient, SquareEnvironment } from 'square'

// Required env vars:
//   SQUARE_ACCESS_TOKEN          — personal/production access token from the Square Developer Dashboard
//   SQUARE_ENVIRONMENT           — "production" or "sandbox" (defaults to sandbox)
//   SQUARE_LOCATION_ID           — the location the subscriptions are billed against
//   SQUARE_WEBHOOK_SIGNATURE_KEY — signature key for the webhook subscription (Webhooks page in the dashboard)
//   SQUARE_WEBHOOK_NOTIFICATION_URL — the exact notification URL registered for that webhook subscription;
//                                     must match byte-for-byte, since Square signs the URL together with the body
export const square = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN || '',
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
})

export function getSquareLocationId(): string {
  const id = process.env.SQUARE_LOCATION_ID
  if (!id) throw new Error('SQUARE_LOCATION_ID is not set')
  return id
}

export function getSquareWebhookConfig() {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL
  if (!signatureKey || !notificationUrl) {
    throw new Error('SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_NOTIFICATION_URL must be set')
  }
  return { signatureKey, notificationUrl }
}
