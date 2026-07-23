/**
 * GitHub Pages deployer.
 *
 * Full flow:
 *  1. Push index.html to a 'gh-pages' branch via the Git Data API
 *     (create blob → create tree → create commit → update/create ref)
 *  2. Enable GitHub Pages via the Pages API (POST; PUT on 409)
 *  3. Return the live Pages URL: https://{owner}.github.io/{repo}
 *
 * The caller MUST supply htmlContent — a complete HTML string for index.html.
 * If htmlContent is empty, a minimal placeholder page is used so Pages still
 * activates and can be updated by a later deployment.
 */

export interface GhPagesResult {
  url: string;
  platform: "github-pages";
  deployedAt: Date;
}

// ---------------------------------------------------------------------------
// Step 1 — Push index.html to gh-pages branch
// ---------------------------------------------------------------------------

async function pushIndexHtmlToGhPages(
  owner: string,
  repo: string,
  token: string,
  htmlContent: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const html = htmlContent.trim().length > 0
    ? htmlContent
    : `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Portfolio</title></head>
<body><h1>Portfolio coming soon…</h1></body>
</html>`;

  console.log(`[GitHubPages] Pushing index.html (${html.length} chars) to ${owner}/${repo}:gh-pages`);

  // ── 1a. Create a blob with the HTML content ───────────────────────────────
  const blobRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: Buffer.from(html).toString("base64"),
        encoding: "base64",
      }),
    }
  );

  if (!blobRes.ok) {
    const err = await blobRes.json().catch(() => ({})) as { message?: string };
    throw new Error(`[GitHubPages] Blob creation failed: ${err.message ?? blobRes.status}`);
  }

  const blob = await blobRes.json() as { sha: string };
  console.log("[GitHubPages] Blob created:", blob.sha.slice(0, 8));

  // ── 1b. Get or create a base tree SHA ────────────────────────────────────
  // Try gh-pages branch first; fall back to main → master; fall back to empty tree.
  let baseTreeSha: string | undefined;
  let parentShas: string[] = [];

  for (const branch of ["gh-pages", "main", "master"]) {
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      { headers }
    );
    if (refRes.ok) {
      const refData = await refRes.json() as { object: { sha: string } };
      const commitSha = refData.object.sha;

      // Get the tree SHA of that commit
      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
        { headers }
      );
      if (commitRes.ok) {
        const commitData = await commitRes.json() as { tree: { sha: string } };
        baseTreeSha = commitData.tree.sha;
        // Only carry the parent commit if it's already on gh-pages (keeps history clean)
        if (branch === "gh-pages") {
          parentShas = [commitSha];
        }
        console.log(`[GitHubPages] Base tree from branch '${branch}':`, baseTreeSha?.slice(0, 8));
        break;
      }
    }
  }

  // ── 1c. Create a new tree with only index.html ───────────────────────────
  const treeBody: Record<string, unknown> = {
    tree: [
      {
        path: "index.html",
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      },
    ],
  };
  if (baseTreeSha) treeBody.base_tree = baseTreeSha;

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(treeBody),
    }
  );

  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({})) as { message?: string };
    throw new Error(`[GitHubPages] Tree creation failed: ${err.message ?? treeRes.status}`);
  }

  const tree = await treeRes.json() as { sha: string };
  console.log("[GitHubPages] Tree created:", tree.sha.slice(0, 8));

  // ── 1d. Create a commit ───────────────────────────────────────────────────
  const commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Deploy portfolio via Career Autopilot",
        tree: tree.sha,
        parents: parentShas,
      }),
    }
  );

  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({})) as { message?: string };
    throw new Error(`[GitHubPages] Commit creation failed: ${err.message ?? commitRes.status}`);
  }

  const commit = await commitRes.json() as { sha: string };
  console.log("[GitHubPages] Commit created:", commit.sha.slice(0, 8));

  // ── 1e. Create or update gh-pages branch ref ─────────────────────────────
  // Try PATCH first (update existing); if 422/404 then POST (create new).
  const patchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/gh-pages`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commit.sha, force: true }),
    }
  );

  if (!patchRes.ok) {
    // Branch doesn't exist yet — create it
    const createRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: "refs/heads/gh-pages",
          sha: commit.sha,
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      throw new Error(`[GitHubPages] Ref create failed: ${err.message ?? createRes.status}`);
    }
    console.log("[GitHubPages] gh-pages branch created");
  } else {
    console.log("[GitHubPages] gh-pages branch updated");
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Enable GitHub Pages on the repository
// ---------------------------------------------------------------------------

async function enableGitHubPages(
  owner: string,
  repo: string,
  token: string,
  branch = "gh-pages"
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const source = { branch, path: "/" };

  // First try POST (creates Pages if never enabled)
  const createRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ source }),
    }
  );

  if (createRes.status === 409) {
    // Pages already exists — update the source branch instead
    console.log("[GitHubPages] Pages already enabled — updating source to gh-pages via PUT");
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pages`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ source }),
      }
    );
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({})) as { message?: string };
      // Non-fatal — the site may still work if Pages was already pointing at the right branch
      console.warn("[GitHubPages] PUT pages update failed (non-fatal):", err.message ?? putRes.status);
    } else {
      console.log("[GitHubPages] Pages source updated to gh-pages");
    }
  } else if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as { message?: string };
    // Non-fatal — Pages may already be live
    console.error("[GitHubPages] Enable Pages failed (non-fatal):", err.message ?? createRes.status);
  } else {
    console.log("[GitHubPages] Pages enabled on gh-pages branch");
  }

  return `https://${owner.toLowerCase()}.github.io/${repo}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function deployToGitHubPages(
  repoOwner: string,
  repoName: string,
  accessToken: string,
  htmlContent: string
): Promise<GhPagesResult> {
  // ── Step 1: Push index.html to gh-pages branch ───────────────────────────
  await pushIndexHtmlToGhPages(repoOwner, repoName, accessToken, htmlContent);

  // ── Step 2: Enable GitHub Pages (targeting gh-pages branch) ──────────────
  const url = await enableGitHubPages(repoOwner, repoName, accessToken, "gh-pages");

  console.log(`[GitHubPages] Deployment complete → ${url}`);
  console.log("[GitHubPages] Note: GitHub Pages takes 1-3 minutes to build after enabling.");

  return { url, platform: "github-pages", deployedAt: new Date() };
}
