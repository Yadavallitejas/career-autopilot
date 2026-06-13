import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, connectedAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

// ---------------------------------------------------------------------------
// GET /api/connected-accounts/linkedin  — OAuth callback from LinkedIn
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const desc = req.nextUrl.searchParams.get("error_description") ?? "OAuth cancelled";
    return NextResponse.redirect(
      new URL(`/settings?linkedin_error=${encodeURIComponent(desc)}`, req.url)
    );
  }

  // ── Exchange code for access token ────────────────────────────────────────
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connected-accounts/linkedin`;

  let accessToken: string;
  let expiresIn: number;

  try {
    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }).toString(),
        cache: "no-store",
      }
    );

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
    };
    accessToken = tokenData.access_token;
    expiresIn = tokenData.expires_in;
  } catch (err) {
    console.error("[linkedin-oauth] Token exchange error:", err);
    return NextResponse.redirect(
      new URL("/settings?linkedin_error=token_exchange_failed", req.url)
    );
  }

  // ── Fetch LinkedIn profile ─────────────────────────────────────────────────
  let platformUserId: string | null = null;
  let platformUsername: string | null = null;

  try {
    const profileRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (profileRes.ok) {
      const profile = (await profileRes.json()) as {
        id?: string;
        localizedFirstName?: string;
        localizedLastName?: string;
      };
      platformUserId = profile.id ?? null;
      if (profile.localizedFirstName || profile.localizedLastName) {
        platformUsername = [profile.localizedFirstName, profile.localizedLastName]
          .filter(Boolean)
          .join(" ");
      }
    }
  } catch {
    // Non-fatal — we still have the token
  }

  // ── Encrypt token + upsert into connected_accounts ────────────────────────
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.redirect(
      new URL("/settings?linkedin_error=user_not_found", req.url)
    );
  }

  const encryptedToken = encrypt(accessToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Upsert: delete existing + insert fresh (cleaner than onConflict with no unique index)
  await db
    .delete(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, user.id),
        eq(connectedAccounts.platform, "linkedin")
      )
    );

  await db.insert(connectedAccounts).values({
    userId: user.id,
    platform: "linkedin",
    accessToken: encryptedToken,
    platformUserId,
    platformUsername,
    expiresAt,
  });

  return NextResponse.redirect(
    new URL("/settings?linkedin_connected=true", req.url)
  );
}

// ---------------------------------------------------------------------------
// DELETE /api/connected-accounts/linkedin  — disconnect
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest): Promise<NextResponse> {
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

  await db
    .delete(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, user.id),
        eq(connectedAccounts.platform, "linkedin")
      )
    );

  return NextResponse.json({ success: true });
}
