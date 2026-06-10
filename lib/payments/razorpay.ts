import Razorpay from "razorpay";

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

export async function createOrder(
  amountPaise: number,
  currency = "INR",
  receipt?: string
): Promise<{ id: string; amount: number; currency: string }> {
  // TODO: Create Razorpay order and return to client
  throw new Error("Not implemented");
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  // TODO: Verify HMAC-SHA256 signature
  throw new Error("Not implemented");
}
