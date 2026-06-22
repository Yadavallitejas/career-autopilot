import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { enqueueAchievementJob } from "@/lib/queue/qstash";

// ---------------------------------------------------------------------------
// POST /api/achievement/[id]/retry
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. Auth check
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const achievementId = params.id;
  if (!achievementId) {
    return NextResponse.json(
      { error: "Missing achievement ID" },
      { status: 400 }
    );
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

  // 3. Fetch achievement (ownership-scoped)
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

  // 4. Only retry if stuck in 'processing' for > 5 minutes
  if (achievement.status !== "processing") {
    return NextResponse.json(
      {
        error: `Cannot retry: achievement is in '${achievement.status}' state (only 'processing' achievements can be retried)`,
      },
      { status: 422 }
    );
  }

  const ageMs = Date.now() - new Date(achievement.createdAt).getTime();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  if (ageMs < FIVE_MINUTES_MS) {
    return NextResponse.json(
      {
        error: "Achievement is still within the normal processing window (< 5 minutes). Please wait.",
        ageMinutes: Math.floor(ageMs / 60_000),
      },
      { status: 422 }
    );
  }

  // 5. Reset status to 'processing' and re-enqueue
  await db
    .update(achievements)
    .set({ status: "processing" })
    .where(eq(achievements.id, achievementId));

  try {
    const messageId = await enqueueAchievementJob({
      achievementId: achievement.id,
      userId: user.id,
    });
    console.log(
      `[retry] Re-enqueued job messageId=${messageId} for achievementId=${achievementId}`
    );
  } catch (qstashErr) {
    console.error(
      `[retry] QStash re-enqueue failed for achievementId=${achievementId}:`,
      qstashErr
    );
    // Return error — the status was already reset to 'processing' so the user can try again
    return NextResponse.json(
      { error: "Failed to re-enqueue job. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({ status: "retrying", achievementId });
}
