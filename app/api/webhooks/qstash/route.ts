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
import { classifyAchievement, type ResumeRules } from "@/lib/ai/classify";
import { draftLinkedInPost, draftXPost } from "@/lib/ai/draft-post";
import { addBulletToResume, buildResumeFromData } from "@/lib/resume/builder";
import { sendEmail } from "@/lib/email/send";
import { AchievementCompleteEmail } from "@/lib/email/templates";
import { checkMediaRelevance } from "@/lib/ai/check-media";

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

  // ─── Step 2: Fetch context ────────────────────────────────────────────────
  logStep("Step 2: Fetching resume + portfolio + user rules context", pipelineStart);

  let currentResume: (typeof resumeVersions.$inferSelect) | undefined;
  let existingResumeText: string | null = null;
  let existingPortfolioProjects: string[] = [];
  let hasPortfolio = false;
  let resumeRules: ResumeRules | null = null;

  try {
    const [currentResumeRows, portfolioRows, userRows] = await Promise.all([
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
      // Fetch user's custom resume rules — no extra round-trip (parallel)
      db
        .select({ resumeRules: users.resumeRules })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    currentResume = currentResumeRows[0];
    const portfolio = portfolioRows[0];
    const userRow = userRows[0];

    // null signals "no resume connected" to classifyAchievement — triggers early return
    existingResumeText = currentResume?.rawText ?? null;
    // Portfolio projects — currently stored as flat config; use deploy URL as context
    hasPortfolio = !!portfolio?.deployUrl;
    existingPortfolioProjects = portfolio?.deployUrl ? [portfolio.deployUrl] : [];
    // Resume rules — cast from jsonb to typed object (null when not set)
    resumeRules = (userRow?.resumeRules as ResumeRules | null) ?? null;

    logStep("Step 2: Context fetched", pipelineStart);
  } catch (contextErr) {
    console.error(
      `[qstash] Step 2: Context fetch failed for achievementId=${achievementId}:`,
      contextErr
    );
    // Non-fatal — proceed with empty context
    logStep("Step 2: Context fetch failed (non-fatal), continuing", pipelineStart);
  }

  // ─── Step 2.5: Enrich with media context ────────────────────────────────
  logStep("Step 2.5: Enriching with media context", pipelineStart);

  let mediaContext = "";

  if (achievement.mediaUrl && achievement.mediaType) {
    try {
      if (achievement.mediaType === "pdf") {
        // PDFs are text-based — download and extract the text
        const response = await fetch(achievement.mediaUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { extractTextFromPdf } = await import("@/lib/resume/extract-text");
        const extractedText = await extractTextFromPdf(buffer);
        mediaContext = `\n\nATTACHED CERTIFICATE (text extracted from PDF):\n${extractedText.slice(0, 3000)}`;
        console.log("[Pipeline] PDF text extracted, length:", extractedText.length);

      } else if (achievement.mediaType === "image") {
        // Images: pass the URL directly to a vision model — do NOT extract text.
        // Vision models understand layout, logos, and scores that text extraction misses.
        const OpenAI = (await import("openai")).default;
        const groq = new OpenAI({
          apiKey: process.env.GROQ_API_KEY ?? "",
          baseURL: "https://api.groq.com/openai/v1",
        });

        const visionResponse = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct", // Groq's vision model
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: achievement.mediaUrl, detail: "low" },
              },
              {
                type: "text",
                text: `This image was attached by a professional to their achievement log. 
              Describe what you see: certificate name, issuer, recipient name, date, score/grade, 
              skills or course name if visible. Be factual and concise. 
              Achievement text they wrote: "${achievement.rawInput}"`,
              },
            ],
          }],
        });

        const imageDescription = visionResponse.choices[0]?.message?.content ?? "";
        if (imageDescription) {
          mediaContext = `\n\nATTACHED IMAGE (AI visual analysis):\n${imageDescription}`;
          console.log("[Pipeline] Image described by vision model:", imageDescription.slice(0, 200));
        }
      }
    } catch (mediaErr) {
      console.warn("[Pipeline] Media enrichment failed (non-fatal):", mediaErr);
      // Non-fatal: classification continues with text only
    }
  }

  logStep("Step 2.5: Media enrichment complete", pipelineStart);

  // ─── Step 3: Classify ────────────────────────────────────────────────────
  logStep("Step 3: Classifying achievement", pipelineStart);

  let classifyResult: Awaited<ReturnType<typeof classifyAchievement>>;

  console.log('[Pipeline] Resume context length:', existingResumeText?.length ?? 0)
  console.log('[Pipeline] Resume context preview:', existingResumeText?.slice(0, 200))

  try {
    classifyResult = await classifyAchievement({
      rawInput: achievement.rawInput,
      mediaContext,              // separate param — not concatenated into rawInput
      existingResumeText,        // null when no resume connected
      existingPortfolioProjects,
      hasPortfolio,              // false = no portfolio; scores will be null
      resumeRules,               // inject user's custom resume preferences into the AI prompt
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
        replaceSuggestion: classifyResult.replaceSuggestion,
        portfolioReplaceSuggestion: classifyResult.portfolioReplaceSuggestion,
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

  // ─── Step 5: Check uploaded media relevance (images only) ──────────────────
  logStep("Step 5: Checking uploaded media", pipelineStart);

  // mediaPromptOverride replaces the AI-generated image suggestion in the
  // LinkedIn post when the user has already uploaded a real image.
  // PDFs are skipped here — they're offered as downloadable references in the
  // post review UI (LinkedIn Images API only accepts jpg/png).
  let mediaPromptOverride: string | null = null;

  if (achievement.mediaUrl && achievement.mediaType === "image") {
    try {
      const mediaCheck = await checkMediaRelevance({
        imageUrl: achievement.mediaUrl,
        achievementText: achievement.rawInput,
      });
      if (mediaCheck.isRelevant) {
        mediaPromptOverride = mediaCheck.suggestedUse;
        console.log(
          `[qstash] Media check passed — suggestedUse: ${mediaCheck.suggestedUse}`
        );
      } else {
        console.log(
          `[qstash] Media check: image not relevant — ${mediaCheck.description}`
        );
      }
    } catch (mediaErr) {
      // Non-fatal — pipeline continues without the media check result
      console.error("[qstash] Media relevance check failed (non-fatal):", mediaErr);
    }
  } else if (achievement.mediaUrl && achievement.mediaType === "pdf") {
    // PDF certificates: set a reference string so the post review UI can
    // surface a "download certificate" link — no vision analysis needed.
    mediaPromptOverride = `PDF certificate attached: ${achievement.mediaUrl}`;
    console.log("[qstash] PDF certificate noted for post review UI");
  }

  logStep("Step 5: Media check complete", pipelineStart);

  // ─── Step 6: Draft LinkedIn post ─────────────────────────────────────────
  logStep("Step 6: Drafting LinkedIn post", pipelineStart);

  let linkedinPostId: string | null = null;

  try {
    const linkedInDraft = await draftLinkedInPost({
      rawInput: achievement.rawInput,
      achievementType: classifyResult.achievementType,
      reasoning: classifyResult.reasoning,
      voiceProfile,
      mediaContext,
      mediaUrl: achievement.mediaUrl,
      mediaType: achievement.mediaType,
    });

    const [insertedPost] = await db
      .insert(posts)
      .values({
        achievementId,
        platform: "linkedin",
        draftText: linkedInDraft.draftText,
        hashtags: linkedInDraft.hashtags,
        // If the user uploaded a real image, use the vision-confirmed prompt;
        // otherwise fall back to the AI-generated image suggestion.
        mediaPrompt: mediaPromptOverride ?? linkedInDraft.mediaPrompt,
        status: "draft",
      })
      .returning({ id: posts.id });

    linkedinPostId = insertedPost?.id ?? null;
    logStep("Step 6: LinkedIn post drafted", pipelineStart);
  } catch (linkedinErr) {
    console.error("[qstash] LinkedIn draft failed:", linkedinErr);
  }

  // ─── Step 7: Draft X post ────────────────────────────────────────────────
  logStep("Step 7: Drafting X post", pipelineStart);

  try {
    const xDraft = await draftXPost({
      rawInput: achievement.rawInput,
      achievementType: classifyResult.achievementType,
      voiceProfile,
      mediaContext,
      mediaUrl: achievement.mediaUrl,
      mediaType: achievement.mediaType,
    });

    await db.insert(posts).values({
      achievementId,
      platform: "x",
      draftText: xDraft.draftText,
      hashtags: xDraft.hashtags,
      status: "draft",
    });

    logStep("Step 7: X post drafted", pipelineStart);
  } catch (xErr) {
    console.error("[qstash] X draft failed:", xErr);
  }

  // ─── Step 8: Resume update ───────────────────────────────────────────────
  logStep("Step 8: Updating resume", pipelineStart);

  let resumeUpdated = false;

  if (classifyResult.resumeWorthy && classifyResult.resumeBullet) {
    if (user && user.resumeSource === "built" && user.autoApplyResumeUpdates) {
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
            const pdfBuffer = await buildResumeFromData(updatedData, resumeRules);

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
      // User uploaded their own resume — do NOT touch their file.
      // Just store the suggestion as pending (already stored on the achievement
      // via resumeBullet/resumeSection columns — no action needed here).
      // The achievement record already has classifiedResumeWorthy=true, 
      // resumeBullet, resumeSection set from the classification step.
      console.log('[Pipeline] Resume suggestion stored as pending — user resume is uploaded type, not auto-applying')
    }
  } else {
    logStep(
      `Step 7: Skipped (resumeWorthy=${classifyResult.resumeWorthy})`,
      pipelineStart
    );
  }

  // ─── Step 9: Mark complete ───────────────────────────────────────────────
  logStep("Step 9: Marking achievement complete", pipelineStart);

  await db
    .update(achievements)
    .set({ status: "complete" })
    .where(eq(achievements.id, achievementId));

  logStep("Step 9: Achievement marked complete", pipelineStart);

  // ─── Step 10: Send completion email ──────────────────────────────────────
  logStep("Step 10: Sending completion email", pipelineStart);

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

      logStep("Step 10: Email sent", pipelineStart);
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
