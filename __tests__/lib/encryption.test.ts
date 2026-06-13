import { encrypt, decrypt } from '../../lib/encryption';
import crypto from 'crypto';

describe('encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should roundtrip a string', () => {
    const keyBytes = crypto.randomBytes(32);
    process.env.ENCRYPTION_KEY = keyBytes.toString('hex');

    const plaintext = 'super secret token 123';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toContain(plaintext);

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it('should throw when decrypting with wrong key', () => {
    const key1 = crypto.randomBytes(32).toString('hex');
    const key2 = crypto.randomBytes(32).toString('hex');

    process.env.ENCRYPTION_KEY = key1;
    const ciphertext = encrypt('test');

    process.env.ENCRYPTION_KEY = key2;
    expect(() => decrypt(ciphertext)).toThrow('Decryption failed');
  });

  it('should produce different ciphertexts for the same input', () => {
    const keyBytes = crypto.randomBytes(32);
    process.env.ENCRYPTION_KEY = keyBytes.toString('hex');

    const plaintext = 'consistent string';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);

    expect(c1).not.toEqual(c2);

    expect(decrypt(c1)).toEqual(plaintext);
    expect(decrypt(c2)).toEqual(plaintext);
  });

  it('should throw if ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY env var is not set');
    expect(() => decrypt('iv:auth:data')).toThrow('ENCRYPTION_KEY env var is not set');
  });

  it('should throw if ENCRYPTION_KEY is wrong length', () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(16).toString('hex');
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 32 bytes when hex-decoded');
  });

  it('should throw if ciphertext format is invalid', () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    expect(() => decrypt('invalid-format')).toThrow('Invalid ciphertext format — expected iv:authTag:data');
  });
});
