import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// PATCH /api/user/resume-rules
// Body: { maxPages, focus, excludeSections, customInstruction }
// ---------------------------------------------------------------------------

export interface ResumeRulesBody {
  maxPages: 1 | 2 | null;
  focus: "technical" | "creative" | "balanced" | null;
  excludeSections: string[];
  customInstruction: string | null;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: ResumeRulesBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Basic validation
    const validFocus = ["technical", "creative", "balanced", null] as const;
    const validMax = [1, 2, null] as const;
    if (!validMax.includes(body.maxPages as any)) {
      return NextResponse.json({ error: "Invalid maxPages value" }, { status: 400 });
    }
    if (!validFocus.includes(body.focus as any)) {
      return NextResponse.json({ error: "Invalid focus value" }, { status: 400 });
    }

    const resumeRules: ResumeRulesBody = {
      maxPages: body.maxPages ?? null,
      focus: body.focus ?? null,
      excludeSections: Array.isArray(body.excludeSections) ? body.excludeSections : [],
      customInstruction: body.customInstruction?.trim() || null,
    };

    const [updated] = await db
      .update(users)
      .set({ resumeRules })
      .where(eq(users.clerkId, clerkId))
      .returning({ id: users.id });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, resumeRules });
  } catch (err) {
    console.error("[PATCH /api/user/resume-rules] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/user/resume-rules — return the current rules for the page load
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ resumeRules: users.resumeRules })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ resumeRules: user.resumeRules ?? null });
}
