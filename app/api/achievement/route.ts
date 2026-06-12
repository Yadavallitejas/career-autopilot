import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { eq, gte, and, count } from "drizzle-orm";
import { enqueueAchievementJob } from "@/lib/queue/qstash";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const createAchievementSchema = z.object({
  rawInput: z
    .string()
    .min(10, "Achievement must be at least 10 characters.")
    .max(2000, "Achievement must be 2000 characters or fewer."),
});

// ---------------------------------------------------------------------------
// Free tier constants
// ---------------------------------------------------------------------------

const FREE_TIER_MONTHLY_LIMIT = 3;

// ---------------------------------------------------------------------------
// POST /api/achievement
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve DB user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Parse + validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createAchievementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 422 }
      );
    }

    const { rawInput } = parsed.data;

    // 4. Free tier check
    if (user.plan === "free") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [monthlyResult] = await db
        .select({ value: count() })
        .from(achievements)
        .where(
          and(
            eq(achievements.userId, user.id),
            gte(achievements.createdAt, startOfMonth)
          )
        );

      const monthlyCount = monthlyResult?.value ?? 0;

      if (monthlyCount >= FREE_TIER_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: "Free tier limit reached",
            code: "FREE_TIER_LIMIT",
            used: monthlyCount,
            limit: FREE_TIER_MONTHLY_LIMIT,
            upgradeUrl: "/settings?tab=billing",
          },
          { status: 429 }
        );
      }
    }

    // 5. Insert achievement record
    const [achievement] = await db
      .insert(achievements)
      .values({
        userId: user.id,
        rawInput,
        status: "processing",
      })
      .returning({ id: achievements.id });

    if (!achievement) {
      throw new Error("Failed to insert achievement record");
    }

    // 6. Enqueue AI pipeline job via QStash
    try {
      const messageId = await enqueueAchievementJob({
        achievementId: achievement.id,
        userId: user.id,
      });
      console.log(
        `[achievement] Enqueued job messageId=${messageId} for achievementId=${achievement.id}`
      );
    } catch (qstashErr) {
      // QStash failure should not block the response — the job can be
      // retried manually. Log prominently and return the achievementId.
      console.error(
        `[achievement] QStash enqueue failed for achievementId=${achievement.id}:`,
        qstashErr
      );
    }

    // 7. Return 201 with the new achievement ID
    return NextResponse.json(
      { achievementId: achievement.id, status: "processing" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/achievement] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/achievement — paginated list (stubbed for future use)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Implement paginated achievement list
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
