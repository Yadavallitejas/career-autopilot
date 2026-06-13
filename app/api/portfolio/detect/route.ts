import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, connectedAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoContents } from "@/lib/github/client";
import { detectProjectType } from "@/lib/portfolio/detect";

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
  try {
    const body = (await req.json()) as { repoOwner: string; repoName: string };
    repoOwner = body.repoOwner;
    repoName = body.repoName;
    if (!repoOwner || !repoName) throw new Error("Missing fields");
  } catch {
    return NextResponse.json(
      { error: "Invalid body — requires repoOwner and repoName" },
      { status: 400 }
    );
  }

  // Resolve GitHub token
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

  // Fetch root-level repo contents
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

  // Attempt to fetch package.json content for richer detection
  let packageJsonContent: string | undefined;
  const packageJsonEntry = contentsResult.find((f) => f.path === "package.json");
  if (packageJsonEntry) {
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

  return NextResponse.json(detection);
}
