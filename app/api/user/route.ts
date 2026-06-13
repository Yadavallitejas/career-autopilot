import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DELETE /api/user  — delete account
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest): Promise<NextResponse> {
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

  // Delete DB record (cascades to all child tables)
  await db.delete(users).where(eq(users.id, user.id));

  // Delete Clerk user (after DB so we don't lose auth mid-transaction)
  try {
    const client = clerkClient();
    await client.users.deleteUser(clerkId);
  } catch (err) {
    // Log but don't fail — DB record is already gone
    console.error("[delete-user] Clerk deletion failed:", err);
  }

  // Return success — client will call signOut() + redirect to /
  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// GET /api/user  — return current user profile
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      plan: users.plan,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// ---------------------------------------------------------------------------
// PATCH /api/user  — update profile fields
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id, voiceProfile: users.voiceProfile })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ["voiceProfile"] as const;
  const update: Partial<typeof users.$inferInsert> = {};

  for (const key of allowed) {
    if (key in body) {
      (update as Record<string, unknown>)[key] = body[key];
    }
  }

  if (Object.keys(update).length > 0) {
    await db.update(users).set(update).where(eq(users.id, user.id));
  }

  return NextResponse.json({ success: true });
}
