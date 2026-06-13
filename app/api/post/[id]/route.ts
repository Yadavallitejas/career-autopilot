import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, posts, achievements } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Ownership guard helper
// ---------------------------------------------------------------------------

async function resolvePostOwnership(
  clerkId: string,
  postId: string
): Promise<{
  userId: string;
  postRow: typeof posts.$inferSelect;
} | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) return null;

  const [row] = await db
    .select({ post: posts })
    .from(posts)
    .innerJoin(achievements, eq(posts.achievementId, achievements.id))
    .where(
      and(eq(posts.id, postId), eq(achievements.userId, user.id))
    )
    .limit(1);

  if (!row) return null;

  return { userId: user.id, postRow: row.post };
}

// ---------------------------------------------------------------------------
// GET /api/post/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await resolvePostOwnership(clerkId, params.id);
  if (!result) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(result.postRow);
}

// ---------------------------------------------------------------------------
// PATCH /api/post/[id]  — auto-save
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await resolvePostOwnership(clerkId, params.id);
  if (!result) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: { draftText?: string; hashtags?: string[]; mediaUrls?: string[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build the partial update — only touch fields that were sent
  const update: Partial<typeof posts.$inferInsert> = {};
  if (typeof body.draftText === "string") update.draftText = body.draftText;
  if (Array.isArray(body.hashtags)) update.hashtags = body.hashtags;
  if (Array.isArray(body.mediaUrls)) update.mediaUrls = body.mediaUrls;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true }); // nothing to update
  }

  await db.update(posts).set(update).where(eq(posts.id, params.id));

  return NextResponse.json({ success: true });
}
