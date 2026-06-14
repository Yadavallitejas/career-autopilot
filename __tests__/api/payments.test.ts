import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyPaymentSignature, verifyWebhookSignature } from '../../lib/payments/razorpay';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Setup environment variables
const originalEnv = process.env;

describe('Payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, RAZORPAY_KEY_SECRET: 'test_secret', RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifyPaymentSignature', () => {
    it('should return true for a correct signature', () => {
      const orderId = 'order_123';
      const paymentId = 'pay_456';

      const expectedSig = crypto.createHmac('sha256', 'test_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const result = verifyPaymentSignature(orderId, paymentId, expectedSig);
      expect(result).toBe(true);
    });

    it('should return false for a wrong signature', () => {
      const orderId = 'order_123';
      const paymentId = 'pay_456';

      const result = verifyPaymentSignature(orderId, paymentId, 'wrong_signature');
      expect(result).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should correctly verify valid webhook signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const secret = 'test_webhook_secret';

      const expectedSig = crypto.createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const result = verifyWebhookSignature(rawBody, expectedSig);
      expect(result).toBe(true);
    });

    it('should return false for invalid webhook signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });

      const result = verifyWebhookSignature(rawBody, 'invalid_sig');
      expect(result).toBe(false);
    });
  });
});
