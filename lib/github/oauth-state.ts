/**
 * Shared HMAC helpers for the GitHub OAuth state parameter.
 *
 * The state format is: <dbUserId>.<nonce>.<hmac>
 * where hmac = HMAC-SHA256(ENCRYPTION_KEY, "<dbUserId>.<nonce>")
 *
 * This makes the state tamper-proof: an attacker without ENCRYPTION_KEY
 * cannot forge a valid state for a different userId.
 */
import crypto from 'crypto'

/** Compute HMAC-SHA256 of `payload` using the app ENCRYPTION_KEY. */
export function signOAuthState(payload: string): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  return crypto.createHmac('sha256', key).update(payload).digest('hex')
}

/**
 * Verify an HMAC-signed OAuth state string.
 * Uses timing-safe comparison to prevent HMAC oracle attacks.
 *
 * @param payload      The signed portion: "<dbUserId>.<nonce>"
 * @param receivedHmac The HMAC segment from the state string
 * @returns true if the HMAC is valid
 */
export function verifyOAuthState(payload: string, receivedHmac: string): boolean {
  const key = process.env.ENCRYPTION_KEY
  if (!key) return false
  const expected = crypto
    .createHmac('sha256', key)
    .update(payload)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(receivedHmac, 'hex')
    )
  } catch {
    // Buffers of different lengths → definitely not equal
    return false
  }
}
