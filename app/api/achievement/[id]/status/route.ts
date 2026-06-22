import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { achievements, users, posts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET /api/achievement/[id]/status
// ---------------------------------------------------------------------------

// Shared no-cache headers — polling must always return fresh data
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Accel-Buffering': 'no',
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Auth check (synchronous cookie read)
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const achievementId = params.id;

    // Validate UUID format early — avoids a wasted DB round-trip on bad input
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(achievementId)) {
      return NextResponse.json(
        { error: "Invalid achievement ID" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Resolve DB user + fetch achievement in parallel
    const [[user], [achievement]] = await Promise.all([
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1),

      // Ownership check is enforced below once we have user.id;
      // fetch by ID only here so both queries fire simultaneously.
      db
        .select()
        .from(achievements)
        .where(eq(achievements.id, achievementId))
        .limit(1),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    // SECURITY: verify ownership — must be done after we have user.id
    if (!achievement || achievement.userId !== user.id) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Fetch associated posts (parallel to nothing — single final query)
    const achievementPosts = await db
      .select({
        id: posts.id,
        platform: posts.platform,
        status: posts.status,
        draftText: posts.draftText,
        publishedUrl: posts.publishedUrl,
      })
      .from(posts)
      .where(eq(posts.achievementId, achievementId));

    // 4. Return with no-cache headers so polling is always fresh
    return NextResponse.json(
      {
        id: achievement.id,
        status: achievement.status,
        resumeScore: achievement.resumeScore,
        portfolioScore: achievement.portfolioScore,
        classifiedResumeWorthy: achievement.classifiedResumeWorthy,
        classifiedPortfolioWorthy: achievement.classifiedPortfolioWorthy,
        reasoning: achievement.reasoning,
        achievementType: achievement.achievementType,
        resumeBullet: achievement.resumeBullet,
        resumeSection: achievement.resumeSection,
        posts: achievementPosts,
        createdAt: achievement.createdAt,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error(
      `[GET /api/achievement/${params.id}/status] Unhandled error:`,
      err
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
