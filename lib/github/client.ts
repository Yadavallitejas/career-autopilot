/**
 * GitHub API client.
 *
 * All functions accept an OAuth access token for the authenticated user.
 * Rate-limit responses are returned as typed error objects — callers decide
 * whether to surface them to the user or retry.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface GithubFile {
  /** Relative path within the repository */
  path: string;
  /** "file" | "dir" | "symlink" | "submodule" */
  type: string;
  /** SHA of the blob */
  sha: string;
  /** File size in bytes (0 for dirs) */
  size: number;
  /** Decoded file content — only present when type === "file" and file was
   *  fetched individually (not as a directory listing) */
  content?: string;
  /** Raw base64 content string as returned by GitHub */
  encodedContent?: string;
  /** Download URL for raw content */
  downloadUrl: string | null;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

/** Returned when GitHub signals 429 / 403 + X-RateLimit-Remaining: 0 */
export interface RateLimitError {
  error: "rate_limited";
  resetAt: number; // Unix timestamp (seconds)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GH_API = "https://api.github.com";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Returns a RateLimitError if the response is rate-limited,
 * otherwise throws with the response body text as the message.
 */
async function handleErrorResponse(
  res: Response
): Promise<RateLimitError | never> {
  const remaining = res.headers.get("X-RateLimit-Remaining");
  const resetHeader = res.headers.get("X-RateLimit-Reset");

  if (
    (res.status === 403 || res.status === 429) &&
    (remaining === "0" || res.status === 429)
  ) {
    const resetAt = resetHeader ? parseInt(resetHeader, 10) : Math.floor(Date.now() / 1000) + 60;
    return { error: "rate_limited", resetAt };
  }

  // For any other error, throw
  let message = `GitHub API error ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // ignore parse error
  }
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// getRepoContents
// ---------------------------------------------------------------------------

/**
 * Fetch the contents of a file or directory in a GitHub repository.
 *
 * - For **directories**: returns an array of GithubFile entries (no content).
 * - For **files**: returns a single-element array with decoded content.
 *
 * @param owner  Repository owner login
 * @param repo   Repository name
 * @param path   Path within the repo (empty string = root)
 * @param token  OAuth access token
 */
export async function getRepoContents(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<GithubFile[] | RateLimitError> {
  const encodedPath = path
    ? path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")
    : "";
  const url = `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

  const res = await fetch(url, {
    headers: authHeaders(token),
    // next.js route cache: no caching for user-specific data
    cache: "no-store",
  });

  if (!res.ok) {
    return handleErrorResponse(res);
  }

  // GitHub returns either an object (file) or array (directory)
  const data = await res.json() as
    | GithubRawFile
    | GithubRawFile[];

  if (Array.isArray(data)) {
    // Directory listing — use arrow wrapper so .map's index arg doesn't leak
    // into mapRawFile's second parameter (decodeContent: boolean)
    return data.map((f) => mapRawFile(f));
  }

  // Single file — decode base64 content
  return [mapRawFile(data, true)];
}

// ---------------------------------------------------------------------------
// listUserRepos
// ---------------------------------------------------------------------------

/**
 * List the authenticated user's repositories, sorted by last push date.
 *
 * @param token  OAuth access token
 * @param page   Page number for pagination (1-indexed, 20 per page)
 */
export async function listUserRepos(
  token: string,
  page = 1
): Promise<GithubRepo[] | RateLimitError> {
  const url = `${GH_API}/user/repos?sort=updated&per_page=20&page=${page}`;

  const res = await fetch(url, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    return handleErrorResponse(res);
  }

  const raw = (await res.json()) as GithubRawRepo[];
  return raw.map(mapRawRepo);
}

// ---------------------------------------------------------------------------
// Existing stubs (kept for backward compat with callers that pre-date this file)
// ---------------------------------------------------------------------------

/** @deprecated use listUserRepos */
export async function getUserRepos(
  accessToken: string
): Promise<GithubRepo[]> {
  const result = await listUserRepos(accessToken, 1);
  if ("error" in result) throw new Error("GitHub rate limited");
  return result;
}

/** Create a new public repository for the authenticated user. */
export async function createRepo(
  accessToken: string,
  name: string,
  description?: string
): Promise<GithubRepo> {
  const res = await fetch(`${GH_API}/user/repos`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, private: false, auto_init: true }),
    cache: "no-store",
  });

  if (!res.ok) {
    await handleErrorResponse(res);
    // handleErrorResponse either returns RateLimitError or throws
    throw new Error("Unexpected error creating repo");
  }

  const raw = (await res.json()) as GithubRawRepo;
  return mapRawRepo(raw);
}

// ---------------------------------------------------------------------------
// Raw GitHub API shapes → typed models
// ---------------------------------------------------------------------------

interface GithubRawFile {
  path: string;
  type: string;
  sha: string;
  size: number;
  content?: string; // base64 with newlines, only on file requests
  download_url: string | null;
  encoding?: string;
}

interface GithubRawRepo {
  id: number;
  name: string;
  full_name: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

function mapRawFile(raw: GithubRawFile, decodeContent = false): GithubFile {
  let decodedContent: string | undefined;
  let encodedContent: string | undefined;

  if (raw.content && raw.encoding === "base64") {
    // GitHub embeds newlines every 60 chars — strip before decoding
    const stripped = raw.content.replace(/\n/g, "");
    encodedContent = stripped;

    if (decodeContent) {
      try {
        // Node.js Buffer-based decoding (server-side only)
        decodedContent = Buffer.from(stripped, "base64").toString("utf-8");
      } catch {
        decodedContent = undefined;
      }
    }
  }

  return {
    path: raw.path,
    type: raw.type,
    sha: raw.sha,
    size: raw.size,
    content: decodedContent,
    encodedContent,
    downloadUrl: raw.download_url,
  };
}

function mapRawRepo(raw: GithubRawRepo): GithubRepo {
  return {
    id: raw.id,
    name: raw.name,
    full_name: raw.full_name,
    language: raw.language,
    stargazers_count: raw.stargazers_count,
    pushed_at: raw.pushed_at,
    html_url: raw.html_url,
    description: raw.description,
    private: raw.private,
    default_branch: raw.default_branch,
  };
}
