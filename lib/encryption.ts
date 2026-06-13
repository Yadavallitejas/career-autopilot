/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 *
 * ENCRYPTION_KEY must be a 32-byte base64-encoded string.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Output format: `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 */
import crypto from 'crypto';

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes

/** Import the raw key from the ENCRYPTION_KEY env var */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");

  const keyBytes = Buffer.from(raw, "hex");
  if (keyBytes.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes when hex-decoded (got ${keyBytes.length})`
    );
  }

  return keyBytes;
}

/**
 * Encrypt a plaintext string.
 * Returns `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV (GCM standard)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  const ivHex = iv.toString("hex");
  const authTagHex = authTag.toString("hex");

  return `${ivHex}:${authTagHex}:${encrypted}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format — expected iv:authTag:data");
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const key = getKey();

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error("Decryption failed");
  }
}
