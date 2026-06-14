import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createOrder,
  PLAN_PRICES,
  type PlanType,
} from "@/lib/payments/razorpay";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── DB user ──────────────────────────────────────────────────────────────
  const [user] = await db
    .select({ id: users.id, plan: users.plan })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let planType: PlanType;
  try {
    const body = (await req.json()) as { planType?: string };
    if (!body.planType || !(body.planType in PLAN_PRICES)) {
      throw new Error("Invalid planType");
    }
    planType = body.planType as PlanType;
  } catch {
    return NextResponse.json(
      { error: "Body must include planType: 'pro_monthly' | 'pro_annual'" },
      { status: 400 }
    );
  }

  const amount = PLAN_PRICES[planType];
  const receiptId = `sub_${user.id.slice(0, 8)}_${Date.now()}`;

  // ── Create Razorpay order ─────────────────────────────────────────────────
  let order: Awaited<ReturnType<typeof createOrder>>;
  try {
    order = await createOrder(amount, receiptId);
  } catch (err) {
    console.error("[create-order] Razorpay error:", err);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: "INR",
    keyId: env.RAZORPAY_KEY_ID,
  });
}
