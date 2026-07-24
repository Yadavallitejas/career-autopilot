import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/[id]/update
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? "";

  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  let body: {
    plan?: "free" | "pro" | "team";
    isTestAccount?: boolean;
    isAdmin?: boolean;
    monthlyLimitOverride?: number | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (body.plan !== undefined) patch.plan = body.plan;
  if (body.isTestAccount !== undefined) patch.isTestAccount = body.isTestAccount;
  if (body.isAdmin !== undefined) patch.isAdmin = body.isAdmin;
  if ("monthlyLimitOverride" in body)
    patch.monthlyLimitOverride = body.monthlyLimitOverride ?? undefined;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  await db.update(users).set(patch).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
