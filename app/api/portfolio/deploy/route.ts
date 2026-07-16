import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, connectedAccounts, portfolioConfig } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoContents } from "@/lib/github/client";
import { detectProjectType } from "@/lib/portfolio/detect";

// ---------------------------------------------------------------------------
// POST /api/portfolio/deploy
// ---------------------------------------------------------------------------

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

  // Parse body
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

  // Resolve GitHub token
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
      { error: "GitHub account not connected" },
      { status: 403 }
    );
  }

  let decryptedToken: string;
  try {
    const { decrypt } = await import("@/lib/encryption");
    decryptedToken = decrypt(account.accessToken);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to decrypt token. Please reconnect your account." },
      { status: 401 }
    );
  }

  // Re-detect (fresh detection on deploy to avoid stale client state)
  const contentsResult = await getRepoContents(
    repoOwner,
    repoName,
    "",
    decryptedToken
  );

  if ("error" in contentsResult) {
    return NextResponse.json(
      { error: "GitHub rate limit reached", resetAt: contentsResult.resetAt },
      { status: 429 }
    );
  }

  let packageJsonContent: string | undefined;
  const pkgEntry = contentsResult.find((f) => f.path === "package.json");
  if (pkgEntry) {
    const fileResult = await getRepoContents(
      repoOwner,
      repoName,
      "package.json",
      decryptedToken
    );
    if (!("error" in fileResult) && fileResult[0]?.content) {
      packageJsonContent = fileResult[0].content;
    }
  }

  const detection = await detectProjectType(contentsResult, packageJsonContent);

  // ── Route to platform deployer ────────────────────────────────────────────
  // Platform deployers are currently stubs — we record the intent in the DB
  // and return a "pending" status. When deployers are implemented they will
  // return a live URL directly.

  const repoFullName = `${repoOwner}/${repoName}`;
  const repoHtmlUrl = `https://github.com/${repoFullName}`;

  // Generate a deterministic placeholder deploy URL for the UI to poll against
  const deployUrlPlaceholder = buildPlaceholderUrl(
    detection.deployTarget,
    repoName,
    account.platformUsername || repoOwner
  );

  // Upsert portfolio_config
  await db
    .insert(portfolioConfig)
    .values({
      userId: user.id,
      githubRepoUrl: repoHtmlUrl,
      deployPlatform: detection.deployTarget,
      projectType: detection.projectType,
      deployUrl: deployUrlPlaceholder,
      template: "minimal",
      lastDeployed: new Date(),
    })
    .onConflictDoUpdate({
      target: portfolioConfig.userId,
      set: {
        githubRepoUrl: repoHtmlUrl,
        deployPlatform: detection.deployTarget,
        projectType: detection.projectType,
        deployUrl: deployUrlPlaceholder,
        lastDeployed: new Date(),
      },
    });

  // Attempt actual platform-specific deploy (stubs throw — catch gracefully)
  let liveDeployUrl = deployUrlPlaceholder;
  try {
    const { deployPortfolio } = await import("@/lib/portfolio/deploy");
    const deployResult = await deployPortfolio(
      repoFullName,
      detection,
      decryptedToken
    );
    liveDeployUrl = deployResult.url;

    // Update with real URL
    await db
      .update(portfolioConfig)
      .set({ deployUrl: liveDeployUrl, lastDeployed: new Date() })
      .where(eq(portfolioConfig.userId, user.id));
  } catch (deployErr) {
    // Platform deployer not yet implemented — return pending status
    console.warn(
      "[portfolio/deploy] Deployer threw (stub?):",
      (deployErr as Error).message
    );
  }

  return NextResponse.json({
    platform: detection.deployTarget,
    deployUrl: liveDeployUrl,
    status: liveDeployUrl === deployUrlPlaceholder ? "pending" : "live",
  });
}

// ---------------------------------------------------------------------------
// GET /api/portfolio/deploy/status
// ---------------------------------------------------------------------------

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
    })
    .from(portfolioConfig)
    .where(eq(portfolioConfig.userId, user.id))
    .limit(1);

  if (!cfg?.deployUrl) {
    return NextResponse.json({ status: "not_started" });
  }

  // Check if the deploy URL is reachable (HEAD request — non-blocking)
  let status: "live" | "pending" | "failed" = "pending";
  try {
    const probe = await fetch(cfg.deployUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (probe.ok) status = "live";
    else if (probe.status >= 500) status = "failed";
  } catch {
    // Network error or timeout — still pending
  }

  return NextResponse.json({
    status,
    deployUrl: cfg.deployUrl,
    platform: cfg.deployPlatform,
    lastDeployed: cfg.lastDeployed,
  });
}

// ---------------------------------------------------------------------------
// Helpers
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
    case "github-pages":
      const username = (ownerUsername || slug).toLowerCase();
      return `https://${username}.github.io/${repoName}`;
    default:
      return `https://${slug}.vercel.app`;
  }
}
