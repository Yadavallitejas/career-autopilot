/**
 * AES-256-GCM encryption utilities for storing OAuth tokens at rest.
 * Key is loaded from ENCRYPTION_KEY env var (32-byte base64 string).
 */

export async function encrypt(plaintext: string): Promise<string> {
  // TODO: implement AES-256-GCM encryption using Web Crypto API
  throw new Error("Not implemented");
}

export async function decrypt(ciphertext: string): Promise<string> {
  // TODO: implement AES-256-GCM decryption using Web Crypto API
  throw new Error("Not implemented");
}
