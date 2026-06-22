import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { achievements, posts, resumeVersions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET /api/debug/pipeline?achievementId=xxx
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Extract query param
  const achievementId = req.nextUrl.searchParams.get("achievementId");
  if (!achievementId) {
    return NextResponse.json(
      { error: "Missing achievementId query parameter" },
      { status: 400 }
    );
  }

  // 3. Resolve DB user from Clerk ID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 4. Fetch achievement (ownership-scoped)
  const [achievement] = await db
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.id, achievementId),
        eq(achievements.userId, user.id)
      )
    )
    .limit(1);

  if (!achievement) {
    return NextResponse.json(
      { error: "Achievement not found or not owned by this user" },
      { status: 404 }
    );
  }

  // 5. Fetch associated posts
  const achievementPosts = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      status: posts.status,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.achievementId, achievementId));

  // 6. Check if user has a current resume
  const [currentResume] = await db
    .select({ id: resumeVersions.id })
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.userId, user.id),
        eq(resumeVersions.isCurrent, true)
      )
    )
    .limit(1);

  // 7. Build diagnostic payload
  const ageMs = Date.now() - new Date(achievement.createdAt).getTime();
  const ageMinutes = Math.floor(ageMs / 60_000);

  return NextResponse.json({
    achievementId: achievement.id,
    status: achievement.status,
    achievementType: achievement.achievementType ?? null,
    resumeScore: achievement.resumeScore ?? null,
    portfolioScore: achievement.portfolioScore ?? null,
    classifiedResumeWorthy: achievement.classifiedResumeWorthy ?? null,
    classifiedPortfolioWorthy: achievement.classifiedPortfolioWorthy ?? null,
    reasoning: achievement.reasoning ?? null,
    createdAt: achievement.createdAt,
    ageMinutes,
    posts: achievementPosts,
    hasResume: !!currentResume,
    isStuck:
      achievement.status === "processing" && ageMinutes > 5,
  });
}
