import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaymentSignature, PLAN_PRICES } from "@/lib/payments/razorpay";
import { sendEmail } from "@/lib/email/send";
import { UpgradeConfirmationEmail } from "@/lib/email/templates";
import * as React from "react";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── DB user ──────────────────────────────────────────────────────────────
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let razorpay_order_id: string;
  let razorpay_payment_id: string;
  let razorpay_signature: string;
  let planType: string;
  try {
    const body = (await req.json()) as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      planType?: string;
    };
    razorpay_order_id = body.razorpay_order_id;
    razorpay_payment_id = body.razorpay_payment_id;
    razorpay_signature = body.razorpay_signature;
    planType = body.planType ?? "pro_monthly";

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing required Razorpay fields");
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Body must include razorpay_order_id, razorpay_payment_id, razorpay_signature",
      },
      { status: 400 }
    );
  }

  // ── Verify signature ──────────────────────────────────────────────────────
  const isValid = verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 }
    );
  }

  // ── Determine billing cycle ───────────────────────────────────────────────
  const billingCycle = planType === "pro_annual" ? "annual" : "monthly";

  // Current period end: 1 month or 1 year from now
  const currentPeriodEnd = new Date();
  if (billingCycle === "annual") {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  } else {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  }

  // ── Upgrade user + upsert subscription (in a transaction) ─────────────────
  await db.transaction(async (tx) => {
    // Upgrade user plan
    await tx
      .update(users)
      .set({ plan: "pro" })
      .where(eq(users.id, user.id));

    // Upsert subscription record
    await tx
      .insert(subscriptions)
      .values({
        userId: user.id,
        razorpayOrderId: razorpay_order_id,
        plan: "pro",
        billingCycle,
        status: "active",
        currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          razorpayOrderId: razorpay_order_id,
          plan: "pro",
          billingCycle,
          status: "active",
          currentPeriodEnd,
        },
      });
  });

  // Send Upgrade Confirmation Email
  if (user && user.id) {
    const userEmailRow = await db.select({ email: users.email }).from(users).where(eq(users.id, user.id)).limit(1);
    if (userEmailRow[0] && userEmailRow[0].email) {
      sendEmail({
        to: userEmailRow[0].email,
        subject: "Upgrade Confirmation - Career Autopilot",
        react: React.createElement(UpgradeConfirmationEmail, {
          userName: userEmailRow[0].email.split("@")[0],
          plan: planType,
          nextBillingDate: currentPeriodEnd,
        }),
      }).catch((err) => console.error("[email] Failed to send UpgradeConfirmationEmail", err));
    }
  }

  return NextResponse.json({ success: true });
}
