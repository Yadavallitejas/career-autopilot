import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, posts, achievements, connectedAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// LinkedIn Posts API (replaces deprecated /v2/ugcPosts)
// Ref: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api
// NOTE: LINKEDIN_VERSION must be a current YYYYMM value. LinkedIn versions
//       expire roughly 12 months after release. If you receive a 400 with
//       "Invalid API Version", update this constant to the current month.
// ---------------------------------------------------------------------------

const LINKEDIN_VERSION = "202506"; // update to YYYYMM of the current month if expired

// ---------------------------------------------------------------------------
// Image upload helper — LinkedIn Images API (two-step: init → binary PUT)
// Ref: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/images-api
// ---------------------------------------------------------------------------

async function uploadImageToLinkedIn(
  imageUrl: string,
  personUrn: string,
  accessToken: string
): Promise<string> {
  const commonHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // Step 1: Initialize the upload to obtain an upload URL and image URN
  const initRes = await fetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: { ...commonHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        initializeUploadRequest: { owner: personUrn },
      }),
      cache: "no-store",
    }
  );

  const initData = (await initRes.json()) as {
    value?: { uploadUrl: string; image: string };
  };

  if (!initRes.ok) {
    throw new Error(
      `LinkedIn image init failed (${initRes.status}): ${JSON.stringify(initData)}`
    );
  }

  const { uploadUrl, image: imageUrn } = initData.value!;

  // Step 2: Download our hosted image then stream the bytes to LinkedIn
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to fetch source image for upload (${imageResponse.status})`
    );
  }
  const imageBuffer = await imageResponse.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Content-Type must NOT be set; LinkedIn's signed URL handles it
    },
    body: imageBuffer,
    cache: "no-store",
  });

  if (!uploadRes.ok) {
    throw new Error(
      `LinkedIn image binary upload failed (${uploadRes.status})`
    );
  }

  // imageUrn looks like "urn:li:image:C5610AQ..."
  return imageUrn;
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

  // ── Ownership check (also fetches achievement media metadata) ─────────────
  const [row] = await db
    .select({
      post: posts,
      achievement: {
        mediaUrl: achievements.mediaUrl,
        mediaType: achievements.mediaType,
      },
    })
    .from(posts)
    .innerJoin(achievements, eq(posts.achievementId, achievements.id))
    .where(and(eq(posts.id, params.id), eq(achievements.userId, user.id)))
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
    .select({
      accessToken: connectedAccounts.accessToken,
      platformUserId: connectedAccounts.platformUserId,
    })
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
  } catch {
    return NextResponse.json(
      {
        error: "Failed to decrypt token. Please reconnect your account.",
        reconnect: true,
      },
      { status: 401 }
    );
  }

  // ── Compose post text ─────────────────────────────────────────────────────
  const commentary =
    hashtags.length > 0
      ? `${finalText}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : finalText;

  // ── Resolve person URN ────────────────────────────────────────────────────
  let authorUrn: string;
  if (liAccount.platformUserId) {
    authorUrn = `urn:li:person:${liAccount.platformUserId}`;
  } else {
    // Fall back to fetching the profile from LinkedIn
    const meRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${decryptedToken}` },
      cache: "no-store",
    });
    if (!meRes.ok) {
      return NextResponse.json(
        { error: "LinkedIn token expired — please reconnect", reconnect: true },
        { status: 401 }
      );
    }
    const meData = (await meRes.json()) as { id?: string };
    if (!meData.id) {
      return NextResponse.json(
        { error: "LinkedIn token expired — please reconnect", reconnect: true },
        { status: 401 }
      );
    }
    authorUrn = `urn:li:person:${meData.id}`;
    // Cache the resolved person ID for future calls
    await db
      .update(connectedAccounts)
      .set({ platformUserId: meData.id })
      .where(
        and(
          eq(connectedAccounts.userId, user.id),
          eq(connectedAccounts.platform, "linkedin")
        )
      )
      .catch(() => {}); // non-fatal
  }

  // ── Upload image (if any) ─────────────────────────────────────────────────
  // Prefer the achievement's stored media; fall back to the request body's URL
  const imageSourceUrl =
    (row.achievement.mediaType === "image" && row.achievement.mediaUrl) ||
    mediaUrl ||
    null;

  let mediaBlock: Record<string, unknown> = {};
  if (imageSourceUrl) {
    try {
      const imageUrn = await uploadImageToLinkedIn(
        imageSourceUrl,
        authorUrn,
        decryptedToken
      );
      mediaBlock = {
        content: {
          media: {
            id: imageUrn,
            altText: "Achievement proof",
          },
        },
      };
    } catch (imgErr) {
      console.error("[LinkedIn Publish] Image upload failed:", imgErr);
      // Non-fatal — publish as text-only rather than aborting the post
    }
  }

  // ── Build Posts API payload ───────────────────────────────────────────────
  const postPayload = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED" },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...mediaBlock,
  };

  // ── Call LinkedIn Posts API ───────────────────────────────────────────────
  let liResponse: Response;
  try {
    liResponse = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decryptedToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
      cache: "no-store",
    });
  } catch (netErr) {
    await db
      .update(posts)
      .set({
        status: "failed",
        errorMessage: "Network error contacting LinkedIn",
      })
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
      .set({
        status: "failed",
        errorMessage: "LinkedIn token expired or insufficient scope",
      })
      .where(eq(posts.id, params.id));
    return NextResponse.json(
      {
        error: "LinkedIn token expired — please reconnect your account",
        reconnect: true,
      },
      { status: 401 }
    );
  }

  if (!liResponse.ok) {
    let errDetail: unknown;
    let errMsg = `LinkedIn API error (${liResponse.status})`;
    try {
      errDetail = await liResponse.json();
      const detail = errDetail as { message?: string };
      if (detail.message) errMsg = detail.message;
    } catch {}

    console.error("[LinkedIn Publish] Failed:", errDetail);
    await db
      .update(posts)
      .set({ status: "failed", errorMessage: errMsg })
      .where(eq(posts.id, params.id));

    return NextResponse.json(
      { error: "LinkedIn rejected the post", details: errDetail },
      { status: 502 }
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  // LinkedIn returns the post URN in the x-restli-id header
  // e.g. "urn:li:share:7..." or "urn:li:ugcPost:..." (both work for the feed URL)
  const postId = liResponse.headers.get("x-restli-id") ?? "";
  const publishedUrl = postId
    ? `https://www.linkedin.com/feed/update/${postId}/`
    : "https://www.linkedin.com/";

  await db
    .update(posts)
    .set({
      status: "published",
      publishedUrl,
      publishedAt: new Date(),
      errorMessage: null,
      // Persist the final edited text
      draftText: finalText,
      hashtags,
      ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
    })
    .where(eq(posts.id, params.id));

  return NextResponse.json({ success: true, postId, publishedUrl });
}
