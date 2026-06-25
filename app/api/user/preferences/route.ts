import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Preferences are stored in users.voiceProfile JSONB under a "prefs" key.
// This avoids a migration while keeping data co-located with the user.
//
// Shape: users.voiceProfile = { ...voiceData, _prefs: { emailNotifications: boolean } }
// ---------------------------------------------------------------------------

type Prefs = {
  emailNotifications?: boolean;
};

function extractPrefs(voiceProfile: unknown): Prefs {
  if (!voiceProfile || typeof voiceProfile !== "object") return {};
  const vp = voiceProfile as Record<string, unknown>;
  const prefs = vp._prefs;
  if (!prefs || typeof prefs !== "object") return {};
  return prefs as Prefs;
}

// ---------------------------------------------------------------------------
// GET /api/user/preferences
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      voiceProfile: users.voiceProfile,
      autoApplyResumeUpdates: users.autoApplyResumeUpdates,
    })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const prefs = extractPrefs(user.voiceProfile);
  return NextResponse.json({
    emailNotifications: prefs.emailNotifications ?? true,
    autoApplyResumeUpdates: user.autoApplyResumeUpdates,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/user/preferences
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id, voiceProfile: users.voiceProfile })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    emailNotifications?: boolean;
    autoApplyResumeUpdates?: boolean;
  };

  const updateData: Partial<typeof users.$inferInsert> = {};

  if (typeof body.emailNotifications === "boolean") {
    // Merge prefs into existing voiceProfile without overwriting voice data
    const existing =
      user.voiceProfile && typeof user.voiceProfile === "object"
        ? (user.voiceProfile as Record<string, unknown>)
        : {};

    const existingPrefs = extractPrefs(existing);
    const newPrefs: Prefs = {
      ...existingPrefs,
      emailNotifications: body.emailNotifications,
    };
    updateData.voiceProfile = { ...existing, _prefs: newPrefs };
  }

  if (typeof body.autoApplyResumeUpdates === "boolean") {
    updateData.autoApplyResumeUpdates = body.autoApplyResumeUpdates;
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.id));
  }

  return NextResponse.json({ success: true });
}
