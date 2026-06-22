import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit } from '../../lib/rate-limit';

// Global mock instance for Redis operations
const mockIncr = vi.fn();
const mockExpire = vi.fn();

// We must mock the Redis class itself correctly.
// A simple way is to define an ES6 class so 'new' works correctly.
vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      incr = mockIncr;
      expire = mockExpire;
    }
  };
});

describe('rateLimit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should enforce the limit after N calls', async () => {
    mockIncr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const res1 = await rateLimit('test-key', 2, 60);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = await rateLimit('test-key', 2, 60);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(0);

    const res3 = await rateLimit('test-key', 2, 60);
    expect(res3.success).toBe(false);
    expect(res3.remaining).toBe(0);
  });

  it('should call expire only on the first request in window', async () => {
    mockIncr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    await rateLimit('test-expire-key', 5, 60);
    expect(mockExpire).toHaveBeenCalledWith('test-expire-key', 60);

    mockExpire.mockClear();
    await rateLimit('test-expire-key', 5, 60);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('should set resetAt correctly based on windowSeconds', async () => {
    mockIncr.mockResolvedValue(1);

    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const res = await rateLimit('test-reset', 5, 60);
    expect(res.resetAt.getTime()).toBe(now.getTime() + 60 * 1000);
  });
});
