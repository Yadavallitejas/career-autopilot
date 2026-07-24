import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/[id]/plan
//
// Atomic action-based plan management. Each action sets ALL relevant fields
// together so the DB never ends up in an inconsistent state.
//
// Actions:
//   grant_pro   → plan='pro',  isTestAccount=false, monthlyLimitOverride=null
//   set_free    → plan='free', isTestAccount=false, monthlyLimitOverride=null
//   mark_test   → plan='free', isTestAccount=true,  monthlyLimitOverride=-1
//   unmark_test → isTestAccount=false, monthlyLimitOverride=null  (plan unchanged)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ── Admin auth ─────────────────────────────────────────────────────────────
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? "";

  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  // ── Parse action ───────────────────────────────────────────────────────────
  let action: string;
  try {
    const body = await req.json();
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_ACTIONS = ["grant_pro", "set_free", "mark_test", "unmark_test"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Unknown action '${action}'. Valid: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // ── Build atomic update ────────────────────────────────────────────────────
  // Each action is complete and self-contained — no partial state possible.
  type UserPatch = Partial<{
    plan: "free" | "pro" | "team";
    isTestAccount: boolean;
    monthlyLimitOverride: number | null;
  }>;

  const patches: Record<string, UserPatch> = {
    // Real Pro: sets plan to 'pro' in the DB — all Pro feature checks
    // (isPro = plan === 'pro' || plan === 'team') automatically resolve to true.
    grant_pro: {
      plan: "pro",
      isTestAccount: false,
      monthlyLimitOverride: null,
    },

    // Revert to free tier with all defaults restored.
    set_free: {
      plan: "free",
      isTestAccount: false,
      monthlyLimitOverride: null,
    },

    // Test account: bypasses monthly limit only — plan stays 'free'.
    // Use this for your own test accounts.
    // monthlyLimitOverride=-1 means unlimited (checked in /api/achievement).
    mark_test: {
      plan: "free",
      isTestAccount: true,
      monthlyLimitOverride: -1,
    },

    // Remove test flags — plan is NOT changed.
    unmark_test: {
      isTestAccount: false,
      monthlyLimitOverride: null,
    },
  };

  const patch = patches[action];

  // ── Apply ──────────────────────────────────────────────────────────────────
  await db.update(users).set(patch).where(eq(users.id, userId));

  console.log(`[admin/plan] ${email} → userId=${userId} action=${action}`, patch);

  return NextResponse.json({ success: true, action, updates: patch });
}
