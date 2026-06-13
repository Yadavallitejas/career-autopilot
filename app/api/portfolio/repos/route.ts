import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, connectedAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { listUserRepos } from "@/lib/github/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  // Get stored GitHub token
  const [account] = await db
    .select({ accessToken: connectedAccounts.accessToken })
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

  const page = parseInt(
    req.nextUrl.searchParams.get("page") ?? "1",
    10
  );

  const result = await listUserRepos(decryptedToken, page);

  if ("error" in result) {
    return NextResponse.json(
      {
        error: "GitHub rate limit reached",
        resetAt: result.resetAt,
      },
      { status: 429 }
    );
  }

  // hasMore: if we got exactly 20 repos there may be more
  return NextResponse.json({ repos: result, hasMore: result.length === 20 });
}
