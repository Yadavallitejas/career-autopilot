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
  connectedAccounts,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyAchievement, type ResumeRules } from "@/lib/ai/classify";
import { draftLinkedInPost, draftXPost } from "@/lib/ai/draft-post";
import { extractCertificateContent, type ExtractedCertificate } from "@/lib/ai/extract-certificate";
import { buildEnrichedInput } from "@/lib/utils";
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
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") throw new Error("Not an object");
  } catch (parseErr) {
    console.error("[qstash] Invalid payload:", parseErr);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ─── Route by job type ───────────────────────────────────────────────────
  // portfolio_deploy jobs have { type: 'portfolio_deploy', userId, repoOwner, repoName }
  // achievement jobs have { achievementId, userId } (no type field)

  if (payload.type === "portfolio_deploy") {
    const userId = payload.userId as string;
    const repoOwner = payload.repoOwner as string;
    const repoName = payload.repoName as string;

    if (!userId || !repoOwner || !repoName) {
      console.error("[qstash/portfolio_deploy] Missing fields:", payload);
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    console.log(`[qstash/portfolio_deploy] Starting: ${repoOwner}/${repoName} userId=${userId}`);

    try {
      // ── Fetch user + GitHub token ─────────────────────────────────────────
      const [userRow] = await db
        .select({ email: users.email, voiceProfile: users.voiceProfile })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [ghAccount] = await db
        .select({ accessToken: connectedAccounts.accessToken })
        .from(connectedAccounts)
        .where(
          and(
            eq(connectedAccounts.userId, userId),
            eq(connectedAccounts.platform, "github")
          )
        )
        .limit(1);

      if (!ghAccount?.accessToken) {
        throw new Error("GitHub account not connected. Connect GitHub in Settings first.");
      }

      const { decrypt } = await import("@/lib/encryption");
      const ghToken = decrypt(ghAccount.accessToken);

      // ── Fetch repo contents + detect project type ─────────────────────────
      const { getRepoContents } = await import("@/lib/github/client");
      const contents = await getRepoContents(repoOwner, repoName, "", ghToken);

      if ("error" in contents) {
        throw new Error("GitHub rate limit reached — try again later.");
      }

      let packageJsonContent: string | undefined;
      const pkgEntry = contents.find((f) => f.path === "package.json");
      if (pkgEntry) {
        const fileResult = await getRepoContents(repoOwner, repoName, "package.json", ghToken);
        if (!("error" in fileResult) && fileResult[0]?.content) {
          packageJsonContent = fileResult[0].content;
        }
      }

      const { detectProjectType } = await import("@/lib/portfolio/detect");
      const detection = await detectProjectType(contents, packageJsonContent);

      console.log(`[qstash/portfolio_deploy] Detected: ${detection.projectType} → ${detection.deployTarget}`);

      const [resumeRows, portfolioCfgRows, recentAchRows] = await Promise.all([
        db
          .select({
            structuredData: resumeVersions.structuredData,
            rawText: resumeVersions.rawText,
          })
          .from(resumeVersions)
          .where(and(eq(resumeVersions.userId, userId), eq(resumeVersions.isCurrent, true)))
          .limit(1),
        db
          .select({ template: portfolioConfig.template })
          .from(portfolioConfig)
          .where(eq(portfolioConfig.userId, userId))
          .limit(1),
        db
          .select({
            rawInput: achievements.rawInput,
            resumeBullet: achievements.resumeBullet,
            achievementType: achievements.achievementType,
          })
          .from(achievements)
          .where(
            and(
              eq(achievements.userId, userId),
              eq(achievements.status, "complete")
            )
          )
          .orderBy(achievements.createdAt)
          .limit(5),
      ]);

      const resumeRow = resumeRows[0];
      const template = (portfolioCfgRows[0]?.template ?? "minimal") as
        "minimal" | "developer" | "creative";

      // Extract display name from voiceProfile if available
      const vp = userRow?.voiceProfile as { fullName?: string } | null;
      const displayName = vp?.fullName ?? userRow?.email?.split('@')[0] ?? 'Portfolio';

      // ── Generate portfolio HTML using AI (always real content) ─────────────
      let htmlContent = "";
      try {
        const { generatePortfolioHTML } = await import("@/lib/portfolio/generate-html");

        // Build the resume data object for the generator
        const structuredFields = resumeRow?.structuredData as Record<string, unknown> | null;

        const resumeDataForGen = {
          ...(structuredFields ?? {}),
          rawText: resumeRow?.rawText ?? null,
        };

        htmlContent = await generatePortfolioHTML(
          { name: displayName, email: userRow?.email ?? '' },
          resumeDataForGen,
          recentAchRows,
          template
        );

        console.log(
          `[qstash/portfolio_deploy] AI generated ${template} HTML (${htmlContent.length} chars)`
        );
      } catch (htmlErr) {
        // Fall back to the static template builder if AI fails
        console.warn("[qstash/portfolio_deploy] AI HTML generation failed, trying static builder:", htmlErr);

        try {
          const { buildMinimalHtml, buildDeveloperHtml, buildCreativeHtml } =
            await import("@/lib/portfolio/generate-from-resume");

          if (resumeRow?.structuredData) {
            const data = resumeRow.structuredData as Parameters<typeof buildMinimalHtml>[0];
            htmlContent = template === "developer"
              ? buildDeveloperHtml(data)
              : template === "creative"
              ? buildCreativeHtml(data)
              : buildMinimalHtml(data);
            console.log(`[qstash/portfolio_deploy] Static builder fallback succeeded (${htmlContent.length} chars)`);
          } else {
            console.error("[qstash/portfolio_deploy] No structured data for static builder — will push minimal placeholder");
          }
        } catch (staticErr) {
          console.error("[qstash/portfolio_deploy] Static builder also failed:", staticErr);
        }
      }

      // ── Deploy ────────────────────────────────────────────────────────────
      const { deployPortfolio } = await import("@/lib/portfolio/deploy");
      const result = await deployPortfolio(repoOwner, repoName, detection, ghToken, htmlContent);

      console.log(
        `[qstash/portfolio_deploy] Deployed → ${result.url} | buildStatus=${result.buildStatus}`
      );

      // ── Persist — only mark 'live' when the Pages build is confirmed ────────
      // If the build is still in progress, write 'deploying' so the client
      // keeps polling /api/portfolio/deploy/status until confirmed.
      await db
        .update(portfolioConfig)
        .set({
          deployUrl: result.url,
          deployStatus: result.buildStatus, // 'live' | 'deploying'
          deployPlatform: result.platform,
          projectType: detection.projectType,
          lastDeployed: new Date(),
          deployError: null,
        })
        .where(eq(portfolioConfig.userId, userId));

      // ── Send success email only when actually live (non-fatal) ─────────────
      if (result.buildStatus === "live" && userRow?.email) {
        const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        sendEmail({
          to: userRow.email,
          subject: "🚀 Your portfolio is live! — Career Autopilot",
          react: React.createElement(AchievementCompleteEmail, {
            userName: userRow.email.split("@")[0],
            achievementType: "portfolio",
            reviewUrl: `${appUrl}/portfolio`,
            resumeUpdated: false,
            portfolioUpdated: true,
          }),
        }).catch((err) => console.error("[qstash/portfolio_deploy] Email failed:", err));
      }

    } catch (deployErr) {
      const errMsg = (deployErr as Error).message ?? "Deployment failed";
      console.error("[qstash/portfolio_deploy] Failed:", errMsg);

      await db
        .update(portfolioConfig)
        .set({ deployStatus: "failed", deployError: errMsg })
        .where(eq(portfolioConfig.userId, userId));
    }

    return NextResponse.json({ ok: true });
  }

  // ─── Achievement job (original pipeline) ────────────────────────────────
  let achievementId: string;
  let userId: string;
  try {
    achievementId = payload.achievementId as string;
    userId = payload.userId as string;
    if (!achievementId || !userId) throw new Error("Missing required fields");
  } catch (parseErr) {
    console.error("[qstash] Invalid achievement payload:", parseErr);
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

  // ── CRITICAL: Log full identity of THIS job so any contamination is visible ──
  // Every field below comes exclusively from the DB row keyed by achievementId.
  // If these values ever mismatch the QStash payload, that points to a DB issue.
  const fileUrl  = achievement.fileUrl  ?? undefined;  // ONLY from this achievement's row
  const fileType = (achievement.fileType ?? undefined) as "image" | "pdf" | "document" | undefined;

  console.log("[QStash] Processing achievement:", {
    id:           achievement.id,           // must equal achievementId from payload
    userId:       achievement.userId,       // must equal userId from payload
    rawInput:     achievement.rawInput.slice(0, 120),
    fileUrl:      fileUrl ?? "none",
    fileType:     fileType ?? "none",
    fileName:     achievement.fileName ?? "none",
    status:       achievement.status,
    createdAt:    achievement.createdAt,
  });

  // Sanity check — these must always match. Log loudly if they ever diverge.
  if (achievement.id !== achievementId) {
    console.error(
      `[QStash] CRITICAL: achievement.id (${achievement.id}) !== achievementId from payload (${achievementId})`
    );
  }
  if (achievement.userId !== userId) {
    console.error(
      `[QStash] CRITICAL: achievement.userId (${achievement.userId}) !== userId from payload (${userId})`
    );
  }

  // CRITICAL: enrichedInput is always scoped to THIS job — never reused across invocations
  // (each serverless invocation has a fresh call stack; no module-level mutation here)
  let enrichedInput: string = achievement.rawInput;  // start clean from current achievement
  let fileContent: string | null = null;              // extracted text, if any

  // ─── Step 2: Fetch context ────────────────────────────────────────────────
  logStep("Step 2: Fetching resume + portfolio + user rules context", pipelineStart);

  let currentResume: (typeof resumeVersions.$inferSelect) | undefined;
  let existingResumeText: string | null = null;
  let existingPortfolioProjects: string[] = [];
  let hasPortfolio = false;
  let resumeRules: ResumeRules | null = null;

  try {
    const [currentResumeRows, portfolioRows, userRows, githubAccountRows] = await Promise.all([
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
      // Check whether the user has connected GitHub (even without a deployed portfolio)
      db
        .select({ id: connectedAccounts.id })
        .from(connectedAccounts)
        .where(
          and(
            eq(connectedAccounts.userId, userId),
            eq(connectedAccounts.platform, "github")
          )
        )
        .limit(1),
    ]);

    currentResume = currentResumeRows[0];
    const portfolio = portfolioRows[0];
    const userRow = userRows[0];

    // null signals "no resume connected" to classifyAchievement — triggers early return
    existingResumeText = currentResume?.rawText ?? null;

    // Portfolio is "connected" if user has either a live deploy OR a connected GitHub account.
    // This prevents the AI from showing "Connect portfolio" nag for GitHub-connected users.
    const hasDeployedPortfolio = !!portfolio?.deployUrl;
    const hasConnectedGitHub = githubAccountRows.length > 0;
    hasPortfolio = hasDeployedPortfolio || hasConnectedGitHub;

    // Only pass a concrete URL when there is an actual deployed portfolio.
    existingPortfolioProjects = hasDeployedPortfolio ? [portfolio!.deployUrl!] : [];

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

  // ─── Step 2.5: Extract file content (new uploads) ───────────────────────
  logStep("Step 2.5: Extracting file content", pipelineStart);

  // enrichedInput and fileContent are already declared above (after Step 1)
  // with values strictly from this achievement — do NOT re-declare here.
  let extractedCertificate: ExtractedCertificate | null = null;

  console.log("[QStash] File for THIS achievement:", {
    achievementId: achievement.id,
    fileUrl: fileUrl ?? "none",
    fileType: fileType ?? "none",
  });

  if (fileUrl && fileType) {
    try {
      console.log("[QStash] Extracting content from file...");
      extractedCertificate = await extractCertificateContent(fileUrl, fileType);

      console.log(
        "[QStash] Extracted cert:",
        extractedCertificate.certificationName,
        "from",
        extractedCertificate.issuingOrganization
      );

      // Persist extracted content so it can be surfaced in the UI / later calls
      await db
        .update(achievements)
        .set({ extractedContent: JSON.stringify(extractedCertificate) })
        .where(eq(achievements.id, achievement.id));

      // Build enriched context: structured cert fields + user's own description
      enrichedInput = buildEnrichedInput(achievement.rawInput, extractedCertificate);
      // Capture extracted text for the pre-classify traceability log
      fileContent = JSON.stringify(extractedCertificate);

      console.log(
        `[QStash] Extraction complete (${fileType}), enrichedInput length: ${enrichedInput.length}`
      );
    } catch (err) {
      console.error("[QStash] Extraction failed, using text only:", err);
      // Degrade gracefully — pipeline continues with rawInput only
    }
  } else if (achievement.mediaUrl && achievement.mediaType) {
    // Legacy path: old mediaUrl/mediaType uploads — keep working as before
    try {
      if (achievement.mediaType === "pdf") {
        const response = await fetch(achievement.mediaUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { extractTextFromPdf } = await import("@/lib/resume/extract-text");
        const extractedText = await extractTextFromPdf(buffer);
        enrichedInput = `${achievement.rawInput}\n\nATTACHED CERTIFICATE (PDF text):\n${extractedText.slice(0, 3000)}`;
        console.log("[Pipeline] Legacy PDF extracted, length:", extractedText.length);
      } else if (achievement.mediaType === "image") {
        const OpenAI = (await import("openai")).default;
        const groq = new OpenAI({
          apiKey: process.env.GROQ_API_KEY ?? "",
          baseURL: "https://api.groq.com/openai/v1",
        });
        const visionResponse = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: achievement.mediaUrl, detail: "low" } },
              { type: "text", text: `Describe this certificate: name, issuer, recipient, date, score, skills. Achievement text: "${achievement.rawInput}"` },
            ],
          }],
        });
        const desc = visionResponse.choices[0]?.message?.content ?? "";
        if (desc) enrichedInput = `${achievement.rawInput}\n\nATTACHED IMAGE (visual analysis):\n${desc}`;
      }
    } catch (mediaErr) {
      console.warn("[Pipeline] Legacy media enrichment failed (non-fatal):", mediaErr);
    }
  }

  logStep("Step 2.5: File extraction complete", pipelineStart);

  // ─── Step 3: Classify ────────────────────────────────────────────────────
  logStep("Step 3: Classifying achievement", pipelineStart);

  let classifyResult: Awaited<ReturnType<typeof classifyAchievement>>;

  console.log("[Pipeline] Resume context length:", existingResumeText?.length ?? 0);
  console.log("[Pipeline] Resume context preview:", existingResumeText?.slice(0, 200));

  // ── Pre-AI verification log — every classify call must be traceable ──────
  // If achievementId or inputPreview ever diverge from what was logged in
  // Step 1, that is the contamination point.
  console.log("[QStash] About to call classifyAchievement with:", {
    achievementId:  achievement.id,
    hasFile:        !!fileUrl,
    fileType:       fileType ?? "none",
    hasExtracted:   !!extractedCertificate,
    fileContent:    fileContent ? `${fileContent.length} chars` : "none",
    inputLength:    enrichedInput.length,
    inputPreview:   enrichedInput.substring(0, 120),
  });

  try {
    classifyResult = await classifyAchievement({
      rawInput: enrichedInput,      // enriched with structured cert data (or raw if no file)
      mediaContext: "",             // mediaContext now folded into enrichedInput
      existingResumeText,
      existingPortfolioProjects,
      hasPortfolio,
      resumeRules,
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
      rawInput: enrichedInput,       // full cert context for richer post copy
      achievementType: classifyResult.achievementType,
      reasoning: classifyResult.reasoning,
      voiceProfile,
      mediaContext: "",              // already folded into enrichedInput
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
      rawInput: enrichedInput,       // full cert context for richer post copy
      achievementType: classifyResult.achievementType,
      voiceProfile,
      mediaContext: "",              // already folded into enrichedInput
      mediaUrl: achievement.mediaUrl,
      mediaType: achievement.mediaType,
    });

    await db.insert(posts).values({
      achievementId,
      platform: "x",
      draftText: xDraft.draftText,
      hashtags: xDraft.hashtags,
      thread: xDraft.thread,
      status: "draft",
    });

    logStep("Step 7: X post drafted", pipelineStart);
  } catch (xErr) {
    console.error("[qstash] X draft failed:", xErr);
  }

  // ─── Step 8: Resume update ───────────────────────────────────────────────
  logStep("Step 8: Updating resume", pipelineStart);

  let resumeUpdated = false;

  if (classifyResult.resumeWorthy && classifyResult.resumeBullet && currentResume) {
    try {
      // Get structured data — for built resumes it exists already,
      // for uploaded resumes we generate it from raw text on demand
      let resumeData = currentResume.structuredData as import("@/lib/resume/builder").ResumeData | null;

      if (!resumeData) {
        // Uploaded resume: structurize the raw text with AI on demand
        console.log("[Pipeline] Structurizing uploaded resume for update");
        const { structurizeResumeText } = await import("@/lib/resume/structurize");
        resumeData = (await structurizeResumeText(currentResume.rawText)) as unknown as import("@/lib/resume/builder").ResumeData;
      }

      // Add the bullet to the correct section
      const section = classifyResult.resumeSection ?? "experience";
      const bullet = classifyResult.resumeBullet;

      if (section.toLowerCase().includes("cert")) {
        resumeData.certifications = [
          ...(resumeData.certifications ?? []),
          {
            name: bullet,
            issuer: classifyResult.achievementType ?? "",
            date: new Date().toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            }),
            url: undefined,
          },
        ];
      } else if (section.toLowerCase().includes("project")) {
        resumeData.projects = [
          ...(resumeData.projects ?? []),
          {
            name: bullet.split(":")[0] ?? bullet,
            description: bullet,
            url: undefined,
            tech: [],
          },
        ];
      } else {
        // Default: prepend bullet to the most recent experience role
        if (resumeData.experience && resumeData.experience.length > 0) {
          resumeData.experience[0].bullets = [
            bullet,
            ...(resumeData.experience[0].bullets ?? []),
          ];
        }
        // If no experience entries exist, the bullet is still captured in the
        // achievement record via resumeBullet — nothing more to do here.
      }

      // Get user's resume rules for PDF generation
      const userResumeRules = (user?.resumeRules as Record<string, unknown>) ?? {};
      const templateId =
        (userResumeRules.templateId as "classic" | "modern") ?? "classic";
      const isPro =
        user?.plan === "pro" || user?.plan === "team" ? true : false;

      // Generate updated PDF — works for both built and uploaded resumes
      const { generateResumePdf } = await import("@/lib/resume/builder");
      // NOTE: named resumeFileUrl (not fileUrl) to avoid shadowing the outer
      // fileUrl which holds THIS achievement's uploaded file URL (line 275).
      const { fileUrl: resumeFileUrl, rawText: newRawText } = await generateResumePdf({
        userId,
        templateId,
        isPro,
        resumeData,
        resumeRules: userResumeRules,
      });

      // Deactivate old version, save new version
      await db
        .update(resumeVersions)
        .set({ isCurrent: false })
        .where(eq(resumeVersions.userId, userId));

      await db.insert(resumeVersions).values({
        userId,
        fileUrl: resumeFileUrl,  // the new resume PDF — NOT the achievement's fileUrl
        rawText: newRawText,
        structuredData: resumeData as unknown as Record<string, unknown>,
        isCurrent: true,
        templateId,
        changesSummary: `Auto-added: ${bullet.slice(0, 80)}…`,
      });

      resumeUpdated = true;
      console.log("[Pipeline] Resume updated successfully for section:", section);
      logStep("Step 8: Resume updated", pipelineStart);
    } catch (resumeErr) {
      // Resume update is non-fatal — achievement still completes
      console.error("[Pipeline] Resume update failed (non-fatal):", resumeErr);
    }
  } else {
    logStep(
      `Step 8: Skipped (resumeWorthy=${classifyResult.resumeWorthy}, hasBullet=${!!classifyResult.resumeBullet}, hasResume=${!!currentResume})`,
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

  // ─── Step 9.5: Auto-regenerate portfolio (non-fatal) ─────────────────────
  // Only runs when the achievement is portfolio-worthy and the user has an
  // existing portfolio deployment. Both Supabase and GitHub Pages are handled.
  if (classifyResult.portfolioWorthy) {
    logStep("Step 9.5: Checking for portfolio auto-regen", pipelineStart);
    try {
      const [pfCfgRow] = await db
        .select({
          deployPlatform: portfolioConfig.deployPlatform,
          deployUrl: portfolioConfig.deployUrl,
          githubRepoUrl: portfolioConfig.githubRepoUrl,
          template: portfolioConfig.template,
        })
        .from(portfolioConfig)
        .where(eq(portfolioConfig.userId, userId))
        .limit(1);

      if (pfCfgRow?.deployPlatform) {
        console.log(
          `[qstash/9.5] Portfolio regen triggered — platform: ${pfCfgRow.deployPlatform}`
        );

        // Fetch latest achievements for the regenerated page
        const latestAchievements = await db
          .select({
            rawInput: achievements.rawInput,
            resumeBullet: achievements.resumeBullet,
            achievementType: achievements.achievementType,
          })
          .from(achievements)
          .where(
            and(
              eq(achievements.userId, userId),
              eq(achievements.status, "complete")
            )
          )
          .orderBy(achievements.createdAt)
          .limit(8);

        const [latestResume] = await db
          .select({
            structuredData: resumeVersions.structuredData,
            rawText: resumeVersions.rawText,
          })
          .from(resumeVersions)
          .where(
            and(
              eq(resumeVersions.userId, userId),
              eq(resumeVersions.isCurrent, true)
            )
          )
          .limit(1);

        const vp2 = user?.voiceProfile as { fullName?: string } | null;
        const displayName2 =
          vp2?.fullName ?? user?.email?.split("@")[0] ?? "Portfolio";

        const { generatePortfolioHTML } = await import(
          "@/lib/portfolio/generate-html"
        );

        const regenResumeData = {
          ...(latestResume?.structuredData as Record<string, unknown> | null ?? {}),
          rawText: latestResume?.rawText ?? null,
        };

        const portfolioTemplate = (pfCfgRow.template ?? "minimal") as
          "minimal" | "developer" | "creative";

        const freshHtml = await generatePortfolioHTML(
          { name: displayName2, email: user?.email ?? "" },
          regenResumeData,
          latestAchievements,
          portfolioTemplate
        );

        if (pfCfgRow.deployPlatform === "supabase") {
          // ── Supabase Storage: re-upload HTML ───────────────────────────────
          const { uploadFile } = await import("@/lib/storage/client");
          const newUrl = await uploadFile(
            Buffer.from(freshHtml, "utf-8"),
            `${userId}/index.html`,
            "text/html",
            "career-autopilot-portfolios"
          );
          await db
            .update(portfolioConfig)
            .set({ deployUrl: newUrl, lastDeployed: new Date(), deployError: null })
            .where(eq(portfolioConfig.userId, userId));

          console.log("[qstash/9.5] Supabase portfolio regenerated:", newUrl);

        } else if (pfCfgRow.deployPlatform === "github-pages" && pfCfgRow.githubRepoUrl) {
          // ── GitHub Pages: push updated index.html to gh-pages branch ───────
          const urlParts = pfCfgRow.githubRepoUrl.replace("https://github.com/", "").split("/");
          const repoOwner = urlParts[0];
          const repoName = urlParts[1];

          if (repoOwner && repoName) {
            const [ghAcc] = await db
              .select({ accessToken: connectedAccounts.accessToken })
              .from(connectedAccounts)
              .where(
                and(
                  eq(connectedAccounts.userId, userId),
                  eq(connectedAccounts.platform, "github")
                )
              )
              .limit(1);

            if (ghAcc?.accessToken) {
              const { decrypt } = await import("@/lib/encryption");
              const regenToken = decrypt(ghAcc.accessToken);
              const { deployToGitHubPages } = await import(
                "@/lib/portfolio/platforms/github-pages"
              );
              const regenResult = await deployToGitHubPages(
                repoOwner,
                repoName,
                regenToken,
                freshHtml
              );
              await db
                .update(portfolioConfig)
                .set({
                  deployStatus: regenResult.buildStatus,
                  lastDeployed: new Date(),
                  deployError: null,
                })
                .where(eq(portfolioConfig.userId, userId));

              console.log(
                `[qstash/9.5] GitHub Pages portfolio regenerated: ${regenResult.url} (${regenResult.buildStatus})`
              );
            }
          }
        }

        logStep("Step 9.5: Portfolio regenerated", pipelineStart);
      } else {
        console.log("[qstash/9.5] No portfolio config found — skipping regen");
      }
    } catch (regenErr) {
      // Non-fatal — never fail the achievement pipeline for portfolio regen
      console.error(
        "[qstash/9.5] Portfolio regen failed (non-fatal):",
        regenErr instanceof Error ? regenErr.message : regenErr
      );
    }
  }

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
