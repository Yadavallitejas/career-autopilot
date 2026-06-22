import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '../../lib/encryption';
import crypto from 'crypto';

describe('Encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // 32-byte key hex encoded (64 characters)
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'secret message';
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).toBeDefined();
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(':')).toHaveLength(3); // iv:authTag:data

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw an error during encryption if ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('secret')).toThrow('ENCRYPTION_KEY env var is not set');
  });

  it('should throw an error during encryption if ENCRYPTION_KEY is invalid length', () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(16).toString('hex'); // 16 bytes
    expect(() => encrypt('secret')).toThrow('ENCRYPTION_KEY must be 32 bytes when hex-decoded');
  });

  it('should throw an error during decryption for invalid ciphertext format', () => {
    expect(() => decrypt('invalidformat')).toThrow('Invalid ciphertext format — expected iv:authTag:data');
  });

  it('should throw an error during decryption for invalid auth tag (tampered data)', () => {
    const plaintext = 'secret message';
    const ciphertext = encrypt(plaintext);
    const parts = ciphertext.split(':');

    // Tamper with data part
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:bad${parts[2].slice(3)}`;

    expect(() => decrypt(tamperedCiphertext)).toThrow('Decryption failed');
  });
});
