import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, posts, achievements, connectedAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// LinkedIn UGC Post API
// Ref: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
// ---------------------------------------------------------------------------

const LINKEDIN_UGC_URL = "https://api.linkedin.com/v2/ugcPosts";

interface LinkedInUGCPostBody {
  author: string; // urn:li:person:{personId}
  lifecycleState: "PUBLISHED";
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: string };
      shareMediaCategory: "NONE" | "IMAGE" | "ARTICLE";
      media?: {
        status: "READY";
        description: { text: string };
        media: string; // urn:li:digitalmediaAsset:{assetId}
        title?: { text: string };
      }[];
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC";
  };
}

async function getLinkedInPersonUrn(token: string): Promise<string | null> {
  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ? `urn:li:person:${data.id}` : null;
}

// ---------------------------------------------------------------------------
// POST /api/post/[id]/publish
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── DB user ──────────────────────────────────────────────────────────────
  const [user] = await db
    .select({ id: users.id, plan: users.plan })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Pro check ────────────────────────────────────────────────────────────
  const isPro = user.plan === "pro" || user.plan === "team";
  if (!isPro) {
    return NextResponse.json(
      { error: "Publishing requires a Pro or Team plan" },
      { status: 403 }
    );
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  const [row] = await db
    .select({ post: posts })
    .from(posts)
    .innerJoin(achievements, eq(posts.achievementId, achievements.id))
    .where(
      and(eq(posts.id, params.id), eq(achievements.userId, user.id))
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (row.post.status === "published") {
    return NextResponse.json(
      { error: "Post is already published" },
      { status: 409 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let finalText: string;
  let hashtags: string[];
  let mediaUrl: string | null;
  try {
    const body = (await req.json()) as {
      finalText: string;
      hashtags: string[];
      mediaUrl?: string | null;
    };
    finalText = body.finalText;
    hashtags = body.hashtags ?? [];
    mediaUrl = body.mediaUrl ?? null;
    if (!finalText) throw new Error("Missing finalText");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Get LinkedIn token ────────────────────────────────────────────────────
  const [liAccount] = await db
    .select({ accessToken: connectedAccounts.accessToken, platformUserId: connectedAccounts.platformUserId })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, user.id),
        eq(connectedAccounts.platform, "linkedin")
      )
    )
    .limit(1);

  if (!liAccount?.accessToken) {
    return NextResponse.json(
      {
        error: "LinkedIn account not connected. Connect it in Settings.",
        reconnect: true,
      },
      { status: 401 }
    );
  }

  let decryptedToken: string;
  try {
    const { decrypt } = await import("@/lib/encryption");
    decryptedToken = decrypt(liAccount.accessToken);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to decrypt token. Please reconnect your account.",
        reconnect: true,
      },
      { status: 401 }
    );
  }

  // ── Compose post text ─────────────────────────────────────────────────────
  const postBody =
    hashtags.length > 0
      ? `${finalText}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : finalText;

  // ── Resolve person URN ────────────────────────────────────────────────────
  let authorUrn: string;
  if (liAccount.platformUserId) {
    authorUrn = `urn:li:person:${liAccount.platformUserId}`;
  } else {
    const resolved = await getLinkedInPersonUrn(decryptedToken);
    if (!resolved) {
      return NextResponse.json(
        { error: "LinkedIn token expired — please reconnect", reconnect: true },
        { status: 401 }
      );
    }
    authorUrn = resolved;
    // Cache the resolved person ID
    await db
      .update(connectedAccounts)
      .set({ platformUserId: authorUrn.replace("urn:li:person:", "") })
      .where(
        and(
          eq(connectedAccounts.userId, user.id),
          eq(connectedAccounts.platform, "linkedin")
        )
      )
      .catch(() => {}); // non-fatal
  }

  // ── Build UGC payload ─────────────────────────────────────────────────────
  const ugcPayload: LinkedInUGCPostBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: postBody },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  // ── Call LinkedIn API ─────────────────────────────────────────────────────
  let liResponse: Response;
  try {
    liResponse = await fetch(LINKEDIN_UGC_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decryptedToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(ugcPayload),
      cache: "no-store",
    });
  } catch (netErr) {
    await db
      .update(posts)
      .set({ status: "failed", errorMessage: "Network error contacting LinkedIn" })
      .where(eq(posts.id, params.id));
    return NextResponse.json(
      { error: "Network error — LinkedIn unreachable" },
      { status: 502 }
    );
  }

  // ── Handle LinkedIn response ──────────────────────────────────────────────
  if (liResponse.status === 401 || liResponse.status === 403) {
    await db
      .update(posts)
      .set({ status: "failed", errorMessage: "LinkedIn token expired or insufficient scope" })
      .where(eq(posts.id, params.id));
    return NextResponse.json(
      { error: "LinkedIn token expired — please reconnect your account", reconnect: true },
      { status: 401 }
    );
  }

  if (liResponse.status !== 201) {
    let errMsg = `LinkedIn API error (${liResponse.status})`;
    try {
      const errBody = (await liResponse.json()) as { message?: string };
      if (errBody.message) errMsg = errBody.message;
    } catch {}

    await db
      .update(posts)
      .set({ status: "failed", errorMessage: errMsg })
      .where(eq(posts.id, params.id));

    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  // ── Success ───────────────────────────────────────────────────────────────
  // LinkedIn returns the URN in X-RestLi-Id header: urn:li:ugcPost:{id}
  const postUrn = liResponse.headers.get("X-RestLi-Id") ?? "";
  const postId = postUrn.split(":").pop() ?? "";
  const publishedUrl = postId
    ? `https://www.linkedin.com/feed/update/${postUrn}/`
    : `https://www.linkedin.com/`;

  await db
    .update(posts)
    .set({
      status: "published",
      publishedUrl,
      publishedAt: new Date(),
      errorMessage: null,
      // also persist the final edited text
      draftText: finalText,
      hashtags,
      ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
    })
    .where(eq(posts.id, params.id));

  return NextResponse.json({ publishedUrl, status: "published" });
}
