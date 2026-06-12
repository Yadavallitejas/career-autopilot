import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { achievements, users, posts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET /api/achievement/[id]/status
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Auth check
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve DB user
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const achievementId = params.id;

    // Validate UUID format to avoid DB errors on garbage input
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(achievementId)) {
      return NextResponse.json(
        { error: "Invalid achievement ID" },
        { status: 400 }
      );
    }

    // 3. Fetch achievement — ownership check is mandatory (userId must match)
    const [achievement] = await db
      .select()
      .from(achievements)
      .where(
        and(
          eq(achievements.id, achievementId),
          eq(achievements.userId, user.id) // SECURITY: ensures user owns this achievement
        )
      )
      .limit(1);

    if (!achievement) {
      // Return 404 regardless of whether it exists (don't leak data)
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    // 4. Fetch associated posts
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

    // 5. Build and return status response
    return NextResponse.json({
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
    });
  } catch (err) {
    console.error(
      `[GET /api/achievement/${params.id}/status] Unhandled error:`,
      err
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
