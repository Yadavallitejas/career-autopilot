import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as React from "react";
import { db } from "@/db";
import {
  achievements,
  posts,
  resumeVersions,
  portfolioConfig,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyAchievement } from "@/lib/ai/classify";
import { draftLinkedInPost, draftXPost } from "@/lib/ai/draft-post";
import { addBulletToResume, buildResumeFromData } from "@/lib/resume/builder";
import { sendEmail } from "@/lib/email/send";
import { AchievementCompleteEmail } from "@/lib/email/templates";

// ---------------------------------------------------------------------------
// Singleton receiver (signing keys never change at runtime)
// ---------------------------------------------------------------------------

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY!,
});

// ---------------------------------------------------------------------------
// Timing helper — logs elapsed ms since pipelineStart
// ---------------------------------------------------------------------------

function logStep(label: string, pipelineStart: number): void {
  console.log(`[qstash] ${label} +${Date.now() - pipelineStart}ms`);
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/qstash
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const pipelineStart = Date.now();

  // ─── Signature verification ─────────────────────────────────────────────
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  try {
    const isValid = await receiver.verify({ signature, body });
    if (!isValid) {
      console.error("[qstash] Signature verification returned false");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (sigErr) {
    // Receiver throws SignatureError on invalid/missing signature
    console.error("[qstash] Signature verification failed:", sigErr);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logStep("Signature verified", pipelineStart);

  // ─── Parse payload ───────────────────────────────────────────────────────
  let achievementId: string;
  let userId: string;
  try {
    const payload = JSON.parse(body) as {
      achievementId: string;
      userId: string;
    };
    achievementId = payload.achievementId;
    userId = payload.userId;

    if (!achievementId || !userId) throw new Error("Missing required fields");
  } catch (parseErr) {
    console.error("[qstash] Invalid payload:", parseErr);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.log('[QStash] Job received:', { achievementId, userId, timestamp: new Date().toISOString() });

  // ─── Step 1: Verify ownership ────────────────────────────────────────────
  logStep(`Step 1: Verifying achievement ${achievementId}`, pipelineStart);

  const achievementRows = await db
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.id, achievementId),
        eq(achievements.userId, userId)
      )
    )
    .limit(1);

  const achievement = achievementRows[0];
  if (!achievement) {
    console.error(
      `[qstash] Achievement not found: id=${achievementId} userId=${userId}`
    );
    return NextResponse.json(
      { error: "Achievement not found" },
      { status: 404 }
    );
  }

  logStep("Step 1: Ownership verified", pipelineStart);

  // ─── Step 2: Fetch context ───────────────────────────────────────────────
  logStep("Step 2: Fetching resume + portfolio context", pipelineStart);

  let currentResume: (typeof resumeVersions.$inferSelect) | undefined;
  let existingResumeText = "";
  let existingPortfolioProjects: string[] = [];

  try {
    const [currentResumeRows, portfolioRows] = await Promise.all([
      db
        .select()
        .from(resumeVersions)
        .where(
          and(
            eq(resumeVersions.userId, userId),
            eq(resumeVersions.isCurrent, true)
          )
        )
        .limit(1),
      db
        .select()
        .from(portfolioConfig)
        .where(eq(portfolioConfig.userId, userId))
        .limit(1),
    ]);

    currentResume = currentResumeRows[0];
    const portfolio = portfolioRows[0];

    existingResumeText = currentResume?.rawText ?? "";
    // Portfolio projects — currently stored as flat config; use deploy URL as context
    existingPortfolioProjects = portfolio?.deployUrl ? [portfolio.deployUrl] : [];

    logStep("Step 2: Context fetched", pipelineStart);
  } catch (contextErr) {
    console.error(
      `[qstash] Step 2: Context fetch failed for achievementId=${achievementId}:`,
      contextErr
    );
    // Non-fatal — proceed with empty context
    logStep("Step 2: Context fetch failed (non-fatal), continuing", pipelineStart);
  }

  // ─── Step 3: Classify ────────────────────────────────────────────────────
  logStep("Step 3: Classifying achievement", pipelineStart);

  let classifyResult: Awaited<ReturnType<typeof classifyAchievement>>;

  try {
    classifyResult = await classifyAchievement({
      rawInput: achievement.rawInput,
      existingResumeText,
      existingPortfolioProjects,
    });

    await db
      .update(achievements)
      .set({
        resumeScore: classifyResult.resumeScore,
        portfolioScore: classifyResult.portfolioScore,
        classifiedResumeWorthy: classifyResult.resumeWorthy,
        classifiedPortfolioWorthy: classifyResult.portfolioWorthy,
        achievementType: classifyResult.achievementType,
        reasoning: classifyResult.reasoning,
        resumeBullet: classifyResult.resumeBullet,
        resumeSection: classifyResult.resumeSection,
        status: "classified",
      })
      .where(eq(achievements.id, achievementId));

    logStep("Step 3: Classification complete", pipelineStart);
  } catch (classifyErr) {
    console.error("[qstash] Classification failed:", classifyErr);
    await db
      .update(achievements)
      .set({ status: "failed" })
      .where(eq(achievements.id, achievementId));
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    );
  }

  // ─── Step 4: Get user + voice profile ───────────────────────────────────
  logStep("Step 4: Fetching user voice profile", pipelineStart);

  let user: (typeof users.$inferSelect) | undefined;
  let voiceProfile: Record<string, unknown> | null = null;

  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    user = userRows[0];
    voiceProfile = (user?.voiceProfile as Record<string, unknown> | null) ?? null;

    logStep("Step 4: User fetched", pipelineStart);
  } catch (userErr) {
    console.error(
      `[qstash] Step 4: User fetch failed for achievementId=${achievementId}:`,
      userErr
    );
    // Non-fatal — proceed without voice profile
    logStep("Step 4: User fetch failed (non-fatal), continuing without voice profile", pipelineStart);
  }

  // ─── Step 5: Draft LinkedIn post ─────────────────────────────────────────
  logStep("Step 5: Drafting LinkedIn post", pipelineStart);

  let linkedinPostId: string | null = null;

  try {
    const linkedInDraft = await draftLinkedInPost({
      rawInput: achievement.rawInput,
      achievementType: classifyResult.achievementType,
      reasoning: classifyResult.reasoning,
      voiceProfile,
    });

    const [insertedPost] = await db
      .insert(posts)
      .values({
        achievementId,
        platform: "linkedin",
        draftText: linkedInDraft.draftText,
        hashtags: linkedInDraft.hashtags,
        mediaPrompt: linkedInDraft.mediaPrompt,
        status: "draft",
      })
      .returning({ id: posts.id });

    linkedinPostId = insertedPost?.id ?? null;
    logStep("Step 5: LinkedIn post drafted", pipelineStart);
  } catch (linkedinErr) {
    console.error("[qstash] LinkedIn draft failed:", linkedinErr);
  }

  // ─── Step 6: Draft X post ────────────────────────────────────────────────
  logStep("Step 6: Drafting X post", pipelineStart);

  try {
    const xDraft = await draftXPost({
      rawInput: achievement.rawInput,
      achievementType: classifyResult.achievementType,
      voiceProfile,
    });

    await db.insert(posts).values({
      achievementId,
      platform: "x",
      draftText: xDraft.draftText,
      hashtags: xDraft.hashtags,
      status: "draft",
    });

    logStep("Step 6: X post drafted", pipelineStart);
  } catch (xErr) {
    console.error("[qstash] X draft failed:", xErr);
  }

  // ─── Step 7: Resume update ───────────────────────────────────────────────
  logStep("Step 7: Updating resume", pipelineStart);

  let resumeUpdated = false;

  if (classifyResult.resumeWorthy && classifyResult.resumeBullet) {
    try {
      if (!currentResume) {
        console.warn(
          "[qstash] Achievement is resume-worthy but user has no current resume — skipping resume update"
        );
      } else {
        // Attempt to parse the stored resume text as structured JSON data.
        // Resume rawText is plain text (not JSON) for now — use the builder's
        // addBulletToResume when it's implemented. For now we record the bullet
        // in the DB and defer PDF generation to the resume builder stub.
        const existingData = (() => {
          try {
            return JSON.parse(currentResume.rawText);
          } catch {
            // rawText is plain text, not JSON — builder will handle conversion
            return null;
          }
        })();

        if (existingData) {
          const updatedData = await addBulletToResume(
            existingData,
            classifyResult.resumeSection ?? "Experience",
            classifyResult.resumeBullet
          );
          const pdfBuffer = await buildResumeFromData(updatedData);

          // Mark previous versions as not current
          await db
            .update(resumeVersions)
            .set({ isCurrent: false })
            .where(
              and(
                eq(resumeVersions.userId, userId),
                eq(resumeVersions.isCurrent, true)
              )
            );

          // Insert new current version
          await db.insert(resumeVersions).values({
            userId,
            templateId: currentResume.templateId ?? "classic",
            // PDF upload to Supabase deferred — store as data URI for now
            fileUrl: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
            rawText: JSON.stringify(updatedData),
            isCurrent: true,
            changesSummary: `Added bullet to ${classifyResult.resumeSection ?? "Experience"}: ${classifyResult.resumeBullet.slice(0, 80)}…`,
          });

          resumeUpdated = true;
          logStep("Step 7: Resume updated", pipelineStart);
        } else {
          console.warn(
            "[qstash] Resume rawText is plain text — skipping structured update until builder is implemented"
          );
        }
      }
    } catch (resumeErr) {
      // Resume update is non-fatal — achievement still completes
      console.error("[qstash] Resume update failed:", resumeErr);
    }
  } else {
    logStep(
      `Step 7: Skipped (resumeWorthy=${classifyResult.resumeWorthy})`,
      pipelineStart
    );
  }

  // ─── Step 8: Mark complete ───────────────────────────────────────────────
  logStep("Step 8: Marking achievement complete", pipelineStart);

  await db
    .update(achievements)
    .set({ status: "complete" })
    .where(eq(achievements.id, achievementId));

  logStep("Step 8: Achievement marked complete", pipelineStart);

  // ─── Step 9: Send completion email ───────────────────────────────────────
  logStep("Step 9: Sending completion email", pipelineStart);

  if (user?.email) {
    try {
      const appUrl =
        env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const linkedinPostUrl = linkedinPostId
        ? `${appUrl}/post/${linkedinPostId}/review`
        : undefined;

      sendEmail({
        to: user.email,
        subject: "✅ Your achievement has been processed — Career Autopilot",
        react: React.createElement(AchievementCompleteEmail, {
          userName: user.email.split("@")[0],
          achievementType: classifyResult.achievementType,
          reviewUrl: linkedinPostUrl,
          resumeUpdated,
          portfolioUpdated: classifyResult.portfolioWorthy,
        }),
      }).catch((err) => console.error("[email] Failed to send email", err));

      logStep("Step 9: Email sent", pipelineStart);
    } catch (emailErr) {
      // Email is non-fatal — never block the 200 response
      console.error("[qstash] Email send failed:", emailErr);
    }
  }

  // ─── Done ────────────────────────────────────────────────────────────────
  const totalMs = Date.now() - pipelineStart;
  console.log(
    `[qstash] Pipeline complete for achievementId=${achievementId} in ${totalMs}ms`
  );

  return NextResponse.json({ success: true });
}
