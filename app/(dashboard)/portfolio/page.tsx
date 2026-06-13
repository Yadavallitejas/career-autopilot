import { requireUser } from "@/lib/get-user";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { connectedAccounts, portfolioConfig, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { PortfolioConfig as PortfolioConfigComponent } from "@/components/portfolio/portfolio-config";

export const metadata = {
  title: "Portfolio — Career Autopilot",
  description: "Deploy and manage your developer portfolio automatically.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to get a GitHub token for the user.
 * Priority:
 *   1. connected_accounts table (stored token)
 *   2. Clerk OAuth token (live lookup) — then upsert into connected_accounts
 */
async function resolveGithubToken(
  clerkId: string,
  dbUserId: string
): Promise<string | null> {
  // 1. Check stored token
  const [stored] = await db
    .select({ accessToken: connectedAccounts.accessToken, id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, dbUserId),
        eq(connectedAccounts.platform, "github")
      )
    )
    .limit(1);

  if (stored?.accessToken) return stored.accessToken;

  // 2. Try Clerk's live token
  try {
    const client = clerkClient();
    const { data } = await client.users.getUserOauthAccessToken(
      clerkId,
      "oauth_github"
    );
    const tokenEntry = data[0];
    if (!tokenEntry?.token) return null;

    // Upsert into connected_accounts for future lookups
    await db
      .insert(connectedAccounts)
      .values({
        userId: dbUserId,
        platform: "github",
        accessToken: tokenEntry.token,
        platformUserId: tokenEntry.externalAccountId,
        platformUsername: null,
      })
      .onConflictDoUpdate({
        target: [connectedAccounts.userId, connectedAccounts.platform],
        set: { accessToken: tokenEntry.token },
      })
      .catch(() => {
        // onConflictDoUpdate needs a unique index — fall back silently
      });

    return tokenEntry.token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage() {
  const user = await requireUser();
  const { userId: clerkId } = auth();

  const [portfolioCfg, githubToken] = await Promise.all([
    db
      .select()
      .from(portfolioConfig)
      .where(eq(portfolioConfig.userId, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    clerkId
      ? resolveGithubToken(clerkId, user.id)
      : Promise.resolve(null),
  ]);

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Portfolio</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {portfolioCfg?.deployUrl
            ? "Your portfolio is live — deployed automatically on new achievements"
            : "Connect GitHub to deploy your portfolio with one click"}
        </p>
      </div>

      <PortfolioConfigComponent
        portfolioConfig={portfolioCfg}
        hasGitHub={Boolean(githubToken)}
        githubToken={githubToken ?? null}
      />
    </div>
  );
}
