import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// PATCH /api/user/onboarding
// Body: { completed: true, voiceProfile?: object, resumeRules?: object }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      completed?: boolean;
      voiceProfile?: Record<string, unknown>;
      resumeRules?: {
        maxPages: 1 | 2 | null;
        focus: "technical" | "creative" | "balanced";
        excludeSections: string[];
        customInstruction: string;
      };
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Build the update object — only include defined fields
    const updatePayload: Record<string, unknown> = {};

    if (body.completed === true) {
      updatePayload.onboardingCompleted = true;
    }
    if (body.voiceProfile !== undefined) {
      updatePayload.voiceProfile = body.voiceProfile;
    }
    if (body.resumeRules !== undefined) {
      updatePayload.resumeRules = body.resumeRules;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.clerkId, clerkId))
      .returning({ id: users.id, onboardingCompleted: users.onboardingCompleted });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      onboardingCompleted: updated.onboardingCompleted,
    });
  } catch (err) {
    console.error("[PATCH /api/user/onboarding] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
