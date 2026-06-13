/**
 * Razorpay server-side helpers.
 *
 * ⚠️  Server-only — never import from client bundles.
 */

import Razorpay from "razorpay";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _razorpay;
}

// ---------------------------------------------------------------------------
// Plan → amount map (paise)
// ---------------------------------------------------------------------------

export const PLAN_PRICES = {
  pro_monthly: 49900,  // ₹499
  pro_annual: 399900,  // ₹3999
} as const;

export type PlanType = keyof typeof PLAN_PRICES;

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
}

/**
 * Create a Razorpay order and return it.
 *
 * @param amount     Amount in paise (e.g. 49900 = ₹499)
 * @param receiptId  Unique receipt identifier (e.g. `sub_${userId}_${Date.now()}`)
 */
export async function createOrder(
  amount: number,
  receiptId: string
): Promise<RazorpayOrderResult> {
  const rz = getRazorpay();
  const order = await rz.orders.create({
    amount,
    currency: "INR",
    receipt: receiptId,
  });
  return order as RazorpayOrderResult;
}

// ---------------------------------------------------------------------------
// verifyPaymentSignature
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature returned by the Razorpay checkout.
 *
 * Razorpay signs `${orderId}|${paymentId}` with the key_secret.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expectedSig = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expectedSig === signature;
}

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

/**
 * Verify a Razorpay webhook payload using the built-in utility.
 * The raw request body string must be passed (not parsed JSON).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  try {
    return Razorpay.validateWebhookSignature(
      rawBody,
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET!
    );
  } catch {
    return false;
  }
}
