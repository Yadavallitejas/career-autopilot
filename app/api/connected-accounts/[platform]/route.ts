import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { connectedAccounts, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  // Return connection status for the given platform
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = params.platform.toLowerCase();
  if (platform !== "github" && platform !== "linkedin") {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  // Resolve user
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
        eq(connectedAccounts.platform, platform)
      )
    );

  return NextResponse.json({ success: true });
}
