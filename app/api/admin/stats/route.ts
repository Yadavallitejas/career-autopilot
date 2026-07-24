import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, achievements, posts } from "@/db/schema";
import { sql, desc, gte, and, eq } from "drizzle-orm";

function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats — aggregate metrics for the dashboard
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? "";

  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers, proUsers, achievementsToday, postsToday, recentAchievements, failedAchievements, allUsers] =
    await Promise.all([
      // Total users
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .then((r) => r[0]?.count ?? 0),

      // Pro users
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`plan != 'free'`)
        .then((r) => r[0]?.count ?? 0),

      // Achievements created today
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(achievements)
        .where(gte(achievements.createdAt, today))
        .then((r) => r[0]?.count ?? 0),

      // Posts published today
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(and(eq(posts.status, "published"), gte(posts.createdAt, today)))
        .then((r) => r[0]?.count ?? 0),

      // Recent 20 achievements across all users
      db
        .select({
          id: achievements.id,
          userId: achievements.userId,
          rawInput: achievements.rawInput,
          status: achievements.status,
          resumeScore: achievements.resumeScore,
          createdAt: achievements.createdAt,
          userEmail: users.email,
        })
        .from(achievements)
        .innerJoin(users, eq(achievements.userId, users.id))
        .orderBy(desc(achievements.createdAt))
        .limit(20),

      // Last 5 failed achievements
      db
        .select({
          id: achievements.id,
          rawInput: achievements.rawInput,
          createdAt: achievements.createdAt,
          userEmail: users.email,
        })
        .from(achievements)
        .innerJoin(users, eq(achievements.userId, users.id))
        .where(eq(achievements.status, "failed"))
        .orderBy(desc(achievements.createdAt))
        .limit(5),

      // All users for the table
      db
        .select({
          id: users.id,
          email: users.email,
          plan: users.plan,
          isTestAccount: users.isTestAccount,
          isAdmin: users.isAdmin,
          monthlyLimitOverride: users.monthlyLimitOverride,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
    ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      proUsers,
      freeUsers: totalUsers - proUsers,
      achievementsToday,
      postsToday,
    },
    users: allUsers,
    recentAchievements,
    failedAchievements,
    aiProvider: process.env.GROQ_API_KEY ? "Groq" : "Anthropic",
  });
}
