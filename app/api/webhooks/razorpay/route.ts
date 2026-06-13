import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { PaymentFailedEmail } from "@/lib/email/templates";
import * as React from "react";

// ---------------------------------------------------------------------------
// Razorpay webhook event shapes (minimal — only what we need)
// ---------------------------------------------------------------------------

interface RazorpayWebhookPayment {
  id: string;
  order_id?: string;
  status?: string;
  email?: string;
  contact?: string;
  error_code?: string;
  error_description?: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookPayment };
    subscription?: { entity?: { id?: string; status?: string; customer_id?: string } };
  };
}

// ---------------------------------------------------------------------------
// Helpers — update user plan and subscription status
// ---------------------------------------------------------------------------

async function setUserPlan(
  razorpayOrderId: string | undefined,
  plan: "free" | "pro",
  subStatus: "active" | "cancelled"
) {
  // Find subscription by order ID
  if (!razorpayOrderId) return;

  const [sub] = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.razorpayOrderId, razorpayOrderId))
    .limit(1);

  if (!sub) return;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ plan })
      .where(eq(users.id, sub.userId));

    await tx
      .update(subscriptions)
      .set({ status: subStatus, plan })
      .where(eq(subscriptions.userId, sub.userId));
  });
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/razorpay
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Read raw body — MUST NOT use req.json() ───────────────────────────────
  const rawBody = await req.text();

  // ── Verify webhook signature ──────────────────────────────────────────────
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const isValid = verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    // Return 200 even on bad signature to prevent Razorpay from retrying
    // but log the failure for security auditing
    console.error(
      "[razorpay-webhook] Invalid signature — possible spoofed request",
      { signature: signature.slice(0, 20) }
    );
    // Return 200 so Razorpay doesn't keep retrying — we just won't act on it
    return NextResponse.json({ received: true });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    console.error("[razorpay-webhook] Failed to parse JSON body");
    return NextResponse.json({ received: true });
  }

  const { event } = payload;
  const paymentEntity = payload.payload?.payment?.entity;
  const subscriptionEntity = payload.payload?.subscription?.entity;

  console.log(`[razorpay-webhook] Received event: ${event}`);

  // ── Event handlers (each wrapped in try/catch — never throw to Razorpay) ──

  // ── payment.captured ─────────────────────────────────────────────────────
  if (event === "payment.captured") {
    try {
      await setUserPlan(paymentEntity?.order_id, "pro", "active");
    } catch (err) {
      console.error("[razorpay-webhook] payment.captured handler error:", err);
    }
  }

  // ── subscription.halted / subscription.cancelled ──────────────────────────
  else if (
    event === "subscription.halted" ||
    event === "subscription.cancelled"
  ) {
    try {
      // For subscription events, we look up by the customer's linked order
      // In practice subscriptions link to an order via razorpaySubId
      const subId = subscriptionEntity?.id;
      if (subId) {
        // Find subscription by razorpaySubId
        const [sub] = await db
          .select({ userId: subscriptions.userId })
          .from(subscriptions)
          .where(eq(subscriptions.razorpaySubId, subId))
          .limit(1);

        if (sub) {
          await db.transaction(async (tx) => {
            await tx
              .update(users)
              .set({ plan: "free" })
              .where(eq(users.id, sub.userId));

            await tx
              .update(subscriptions)
              .set({ status: "cancelled", plan: "free" })
              .where(eq(subscriptions.userId, sub.userId));
          });
        }
      }
    } catch (err) {
      console.error(
        `[razorpay-webhook] ${event} handler error:`,
        err
      );
    }
  }

  // ── payment.failed ────────────────────────────────────────────────────────
  else if (event === "payment.failed") {
    try {
      const orderId = paymentEntity?.order_id;
      const errorDesc =
        paymentEntity?.error_description ?? "Unknown payment failure";

      console.warn(
        `[razorpay-webhook] Payment failed for order ${orderId}: ${errorDesc}`
      );

      // Send failure email if we can resolve the user
      if (orderId) {
        const [sub] = await db
          .select({ userId: subscriptions.userId })
          .from(subscriptions)
          .where(eq(subscriptions.razorpayOrderId, orderId))
          .limit(1);

        if (sub) {
          const [user] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, sub.userId))
            .limit(1);

          if (user?.email) {
            // Attempt to send failure email — non-fatal if it throws
            try {
              const { sendEmail } = await import("@/lib/email/send");
              // sendEmail currently throws "Not implemented" — swallow gracefully
              sendEmail({
                to: user.email,
                subject: "Payment failed — Career Autopilot",
                react: React.createElement(PaymentFailedEmail, {
                  userName: user.email.split("@")[0],
                  retryUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://career-autopilot.com"}/pricing`,
                }),
              }).catch((err) => console.error("[email] Failed to send email", err));
            } catch {
              // Email not yet implemented — log and continue
              console.warn(
                `[razorpay-webhook] Could not send failure email to ${user.email}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("[razorpay-webhook] payment.failed handler error:", err);
    }
  }

  // ── Always return 200 ─────────────────────────────────────────────────────
  return NextResponse.json({ received: true });
}
