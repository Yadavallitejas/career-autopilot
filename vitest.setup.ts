import { vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    RAZORPAY_KEY_SECRET: 'test_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    UPSTASH_REDIS_REST_URL: 'mock',
    UPSTASH_REDIS_REST_TOKEN: 'mock'
  }
}));
