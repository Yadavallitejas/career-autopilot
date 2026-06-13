/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 *
 * ENCRYPTION_KEY must be a 32-byte base64-encoded string.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Output format: `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256; // bits

/** Import the raw key from the ENCRYPTION_KEY env var */
async function getKey(): Promise<CryptoKey> {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");

  const keyBytes = Buffer.from(raw, "base64");
  if (keyBytes.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes when base64-decoded (got ${keyBytes.length})`
    );
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string.
 * Returns `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV (GCM standard)

  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // Web Crypto AES-GCM appends the 16-byte auth tag to the ciphertext
  const cipherBytes = new Uint8Array(cipherBuffer);
  const ciphertext = cipherBytes.slice(0, -16);
  const authTag = cipherBytes.slice(-16);

  const ivHex = Buffer.from(iv).toString("hex");
  const authTagHex = Buffer.from(authTag).toString("hex");
  const ciphertextHex = Buffer.from(ciphertext).toString("hex");

  return `${ivHex}:${authTagHex}:${ciphertextHex}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format — expected iv:authTag:data");
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  // Reassemble with auth tag appended (Web Crypto AES-GCM expects this)
  const cipherBuffer = new Uint8Array(data.length + authTag.length);
  cipherBuffer.set(data);
  cipherBuffer.set(authTag, data.length);

  const key = await getKey();
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    cipherBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}
