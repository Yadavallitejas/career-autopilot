import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/payments/cancel
 *
 * Marks the subscription as cancelled in DB.
 * The user retains Pro access until currentPeriodEnd.
 *
 * TODO: Also call Razorpay's subscription cancellation API when subscription
 * IDs are stored (requires razorpay.subscriptions.cancel(subId)).
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [sub] = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  if (!sub) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  if (sub.status === "cancelled") {
    return NextResponse.json({ success: true, alreadyCancelled: true });
  }

  await db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(eq(subscriptions.id, sub.id));

  // Note: plan stays 'pro' until currentPeriodEnd — a cron job / webhook
  // from Razorpay will flip it to 'free' when the period expires.

  return NextResponse.json({ success: true });
}
