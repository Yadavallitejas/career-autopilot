import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { enqueueAchievementJob } from "@/lib/queue/qstash";
import { uploadFile } from "@/lib/storage/client";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const createAchievementSchema = z.object({
  rawInput: z
    .string()
    .min(10, "Achievement must be at least 10 characters.")
    .max(2000, "Achievement must be 2000 characters or fewer."),
  fileUrl: z.string().url().optional(),
  fileType: z.enum(["image", "pdf", "document"]).optional(),
  fileName: z.string().optional(),
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

    // 3. Parse + validate body (supports both JSON and multipart/form-data)
    let rawInput: string;
    let mediaFile: File | null = null;
    let fileUrl: string | undefined;
    let fileType: "image" | "pdf" | "document" | undefined;
    let fileName: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        rawInput = formData.get("rawInput") as string;
        mediaFile = (formData.get("media") as File | null) ?? null;
        // Treat empty File objects as null
        if (mediaFile && mediaFile.size === 0) mediaFile = null;
      } else {
        const body = await req.json();
        rawInput = body.rawInput;
        fileUrl = body.fileUrl;
        fileType = body.fileType;
        fileName = body.fileName;
      }
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = createAchievementSchema.safeParse({ rawInput, fileUrl, fileType, fileName });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 422 }
      );
    }

    ({ rawInput, fileUrl, fileType, fileName } = parsed.data);

    // 4. Monthly limit check
    // Order of precedence:
    //   1. isTestAccount  → unlimited (bypass everything)
    //   2. plan is pro/team → unlimited
    //   3. monthlyLimitOverride === -1 → unlimited
    //   4. monthlyLimitOverride > 0 → custom cap
    //   5. default free-tier cap (FREE_TIER_MONTHLY_LIMIT)
    const skipLimit = user.isTestAccount || user.plan !== "free";

    if (!skipLimit) {
      const limitToUse =
        user.monthlyLimitOverride === -1
          ? Infinity
          : (user.monthlyLimitOverride ?? FREE_TIER_MONTHLY_LIMIT);

      if (limitToUse !== Infinity) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [monthlyResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(achievements)
          .where(
            and(
              eq(achievements.userId, user.id),
              eq(achievements.status, "complete"), // Only count completed ones
              gte(achievements.createdAt, startOfMonth)
            )
          );

        const monthlyCount = monthlyResult?.count ?? 0;

        if (monthlyCount >= limitToUse) {
          return NextResponse.json(
            {
              error: "Free tier limit reached",
              code: "FREE_TIER_LIMIT",
              used: monthlyCount,
              limit: limitToUse,
              upgradeUrl: "/settings?tab=billing",
            },
            { status: 429 }
          );
        }
      }
    }

    // 5. Upload attached media (non-fatal — achievement is created even if upload fails)
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (mediaFile) {
      try {
        const ext = mediaFile.type === "application/pdf" ? "pdf" : "jpg";
        const path = `achievements/${user.id}/${Date.now()}.${ext}`;
        const buffer = Buffer.from(await mediaFile.arrayBuffer());
        mediaUrl = await uploadFile(buffer, path, mediaFile.type, "post-media");
        mediaType = mediaFile.type === "application/pdf" ? "pdf" : "image";
        console.log(`[achievement] Media uploaded: ${mediaUrl}`);
      } catch (uploadErr) {
        // Non-fatal — log and continue without media rather than blocking
        console.error("[achievement] Media upload failed (non-fatal):", uploadErr);
      }
    }

    // 6. Insert achievement record
    const [achievement] = await db
      .insert(achievements)
      .values({
        userId: user.id,
        rawInput,
        ...(mediaUrl ? { mediaUrl, mediaType } : {}),
        ...(fileUrl ? { fileUrl } : {}),
        ...(fileType ? { fileType } : {}),
        ...(fileName ? { fileName } : {}),
        status: "processing",
      })
      .returning({ id: achievements.id });

    if (!achievement) {
      throw new Error("Failed to insert achievement record");
    }

    // 7. Enqueue AI pipeline job via QStash
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

    // 8. Return 201 with the new achievement ID
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
