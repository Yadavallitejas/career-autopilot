/**
 * GitHub Pages deployer.
 *
 * Uses the repository owner's OAuth token (from connectedAccounts) to:
 *  1. Detect which branch exists (main → master → error)
 *  2. POST to the GitHub Pages API to enable Pages
 *  3. Handle 409 Conflict gracefully (Pages already enabled — fetch URL)
 *  4. Return the live Pages URL: https://{owner}.github.io/{repo}
 */

export interface GhPagesResult {
  url: string;
  platform: "github-pages";
  deployedAt: Date;
}

export async function deployToGitHubPages(
  repoOwner: string,
  repoName: string,
  accessToken: string
): Promise<GhPagesResult> {
  const ghHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  // ── 1. Detect the default branch ─────────────────────────────────────────
  let branch: "main" | "master" = "main";

  const mainRes = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/branches/main`,
    { headers: ghHeaders }
  );

  if (!mainRes.ok) {
    const masterRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/branches/master`,
      { headers: ghHeaders }
    );
    if (!masterRes.ok) {
      throw new Error(
        "Repository has no main or master branch. Push at least one commit first."
      );
    }
    branch = "master";
  }

  console.log(`[GitHubPages] Using branch: ${branch}`);

  // ── 2. Enable GitHub Pages ────────────────────────────────────────────────
  const enableRes = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/pages`,
    {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ source: { branch, path: "/" } }),
    }
  );

  // ── 3. Handle 409 — Pages already enabled ─────────────────────────────────
  if (enableRes.status === 409) {
    console.log("[GitHubPages] Pages already enabled — fetching existing URL");
    const getRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pages`,
      { headers: ghHeaders }
    );
    if (getRes.ok) {
      const existing = (await getRes.json()) as { html_url?: string };
      const url =
        existing.html_url ??
        `https://${repoOwner.toLowerCase()}.github.io/${repoName}`;
      return { url, platform: "github-pages", deployedAt: new Date() };
    }
    // Fallback to deterministic URL
    return {
      url: `https://${repoOwner.toLowerCase()}.github.io/${repoName}`,
      platform: "github-pages",
      deployedAt: new Date(),
    };
  }

  // ── 4. Any other non-2xx error ────────────────────────────────────────────
  if (!enableRes.ok) {
    let msg = `HTTP ${enableRes.status}`;
    try {
      const errBody = (await enableRes.json()) as { message?: string };
      if (errBody.message) msg = errBody.message;
    } catch { /* ignore */ }
    throw new Error(`GitHub Pages enable failed: ${msg}`);
  }

  // ── 5. Success ────────────────────────────────────────────────────────────
  let url: string;
  try {
    const data = (await enableRes.json()) as { html_url?: string };
    url =
      data.html_url ??
      `https://${repoOwner.toLowerCase()}.github.io/${repoName}`;
  } catch {
    url = `https://${repoOwner.toLowerCase()}.github.io/${repoName}`;
  }

  console.log(`[GitHubPages] Pages enabled → ${url}`);
  return { url, platform: "github-pages", deployedAt: new Date() };
}
