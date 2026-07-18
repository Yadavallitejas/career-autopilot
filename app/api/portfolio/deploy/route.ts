import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, connectedAccounts, portfolioConfig } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoContents } from "@/lib/github/client";
import { detectProjectType } from "@/lib/portfolio/detect";
import { enqueuePortfolioDeployJob } from "@/lib/queue/qstash";

// ---------------------------------------------------------------------------
// POST /api/portfolio/deploy
// ---------------------------------------------------------------------------
//
// No longer runs the deployment synchronously (would timeout at 10s).
// Instead:
//   1. Resolves the GitHub token + detects project type (fast)
//   2. Upserts portfolio_config with deployStatus = 'deploying'
//   3. Pushes a portfolio_deploy job to QStash
//   4. Returns immediately with { status: 'deploying' }
//
// The QStash handler (/api/webhooks/qstash) does the actual deployment
// and writes the final deployStatus / deployUrl back to the DB.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let repoOwner: string;
  let repoName: string;
  let confirmed: boolean;
  try {
    const body = (await req.json()) as {
      repoOwner: string;
      repoName: string;
      confirmed: boolean;
    };
    repoOwner = body.repoOwner;
    repoName = body.repoName;
    confirmed = body.confirmed;
    if (!repoOwner || !repoName || !confirmed)
      throw new Error("Missing fields");
  } catch {
    return NextResponse.json(
      { error: "Invalid body — requires repoOwner, repoName, confirmed:true" },
      { status: 400 }
    );
  }

  // ── Resolve GitHub token ───────────────────────────────────────────────────
  const [account] = await db
    .select({
      accessToken: connectedAccounts.accessToken,
      platformUsername: connectedAccounts.platformUsername,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, user.id),
        eq(connectedAccounts.platform, "github")
      )
    )
    .limit(1);

  if (!account?.accessToken) {
    return NextResponse.json(
      { error: "GitHub account not connected. Connect GitHub in Settings first." },
      { status: 403 }
    );
  }

  let decryptedToken: string;
  try {
    const { decrypt } = await import("@/lib/encryption");
    decryptedToken = decrypt(account.accessToken);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt token. Please reconnect your account." },
      { status: 401 }
    );
  }

  // ── Detect project type (fast — a couple of GitHub API calls) ─────────────
  const contentsResult = await getRepoContents(repoOwner, repoName, "", decryptedToken);

  if ("error" in contentsResult) {
    return NextResponse.json(
      { error: "GitHub rate limit reached", resetAt: contentsResult.resetAt },
      { status: 429 }
    );
  }

  let packageJsonContent: string | undefined;
  const pkgEntry = contentsResult.find((f) => f.path === "package.json");
  if (pkgEntry) {
    const fileResult = await getRepoContents(repoOwner, repoName, "package.json", decryptedToken);
    if (!("error" in fileResult) && fileResult[0]?.content) {
      packageJsonContent = fileResult[0].content;
    }
  }

  const detection = await detectProjectType(contentsResult, packageJsonContent);

  const repoHtmlUrl = `https://github.com/${repoOwner}/${repoName}`;

  // ── Upsert portfolio_config — mark as deploying ───────────────────────────
  await db
    .insert(portfolioConfig)
    .values({
      userId: user.id,
      githubRepoUrl: repoHtmlUrl,
      deployPlatform: detection.deployTarget,
      projectType: detection.projectType,
      deployUrl: null,
      deployStatus: "deploying",
      deployError: null,
      template: "minimal",
    })
    .onConflictDoUpdate({
      target: portfolioConfig.userId,
      set: {
        githubRepoUrl: repoHtmlUrl,
        deployPlatform: detection.deployTarget,
        projectType: detection.projectType,
        deployStatus: "deploying",
        deployError: null,
      },
    });

  // ── Push to QStash ────────────────────────────────────────────────────────
  try {
    const messageId = await enqueuePortfolioDeployJob({
      type: "portfolio_deploy",
      userId: user.id,
      repoOwner,
      repoName,
    });
    console.log(`[portfolio/deploy] QStash job queued — messageId=${messageId}`);
  } catch (qstashErr) {
    // QStash failure: update status to failed so the UI doesn't poll forever
    await db
      .update(portfolioConfig)
      .set({
        deployStatus: "failed",
        deployError: "Failed to queue deployment job. Please try again.",
      })
      .where(eq(portfolioConfig.userId, user.id));

    console.error("[portfolio/deploy] QStash enqueue failed:", qstashErr);
    return NextResponse.json(
      { error: "Failed to queue deployment. Please try again." },
      { status: 500 }
    );
  }

  // ── Return immediately ────────────────────────────────────────────────────
  return NextResponse.json({
    status: "deploying",
    platform: detection.deployTarget,
    message: "Deployment started. This usually takes 1–3 minutes.",
  });
}

// ---------------------------------------------------------------------------
// GET /api/portfolio/deploy — status check (polled by the UI every 5s)
// ---------------------------------------------------------------------------
//
// Reads deployStatus and deployError directly from DB — the QStash handler
// writes the final values once deployment completes or fails.

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [cfg] = await db
    .select({
      deployUrl: portfolioConfig.deployUrl,
      deployPlatform: portfolioConfig.deployPlatform,
      lastDeployed: portfolioConfig.lastDeployed,
      deployStatus: portfolioConfig.deployStatus,
      deployError: portfolioConfig.deployError,
    })
    .from(portfolioConfig)
    .where(eq(portfolioConfig.userId, user.id))
    .limit(1);

  if (!cfg) {
    return NextResponse.json({ status: "not_started" });
  }

  const status = (cfg.deployStatus ?? "none") as
    | "none"
    | "deploying"
    | "live"
    | "failed";

  return NextResponse.json({
    status,
    deployUrl: cfg.deployUrl,
    platform: cfg.deployPlatform,
    lastDeployed: cfg.lastDeployed,
    deployError: cfg.deployError,
  });
}

// ---------------------------------------------------------------------------
// Helpers (kept for legacy callers — unused now that detection is inline)
// ---------------------------------------------------------------------------

function buildPlaceholderUrl(
  deployTarget: string,
  repoName: string,
  ownerUsername?: string
): string {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  switch (deployTarget) {
    case "vercel":
      return `https://${slug}.vercel.app`;
    case "netlify":
      return `https://${slug}.netlify.app`;
    case "render":
      return `https://${slug}.onrender.com`;
    case "railway":
      return `https://${slug}.railway.app`;
    case "github-pages": {
      const username = (ownerUsername || slug).toLowerCase();
      return `https://${username}.github.io/${repoName}`;
    }
    default:
      return `https://${slug}.vercel.app`;
  }
}


