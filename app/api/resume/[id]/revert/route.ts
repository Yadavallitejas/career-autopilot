import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, resumeVersions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve DB user
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify that the target version belongs to this user
  const [targetVersion] = await db
    .select({ id: resumeVersions.id })
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.id, params.id),
        eq(resumeVersions.userId, user.id)
      )
    )
    .limit(1);

  if (!targetVersion) {
    return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
  }

  // Atomic revert: clear all current flags, then set the target
  await db.transaction(async (tx) => {
    // 1. Clear all isCurrent flags for this user
    await tx
      .update(resumeVersions)
      .set({ isCurrent: false })
      .where(eq(resumeVersions.userId, user.id));

    // 2. Set the target version as current
    await tx
      .update(resumeVersions)
      .set({ isCurrent: true })
      .where(eq(resumeVersions.id, params.id));
  });

  return NextResponse.json({ success: true, revertedTo: params.id });
}
