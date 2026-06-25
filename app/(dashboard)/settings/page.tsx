import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { connectedAccounts, subscriptions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata = {
  title: "Settings — Career Autopilot",
  description: "Manage your connected accounts, billing, and preferences.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { linkedin_error?: string; linkedin_connected?: string };
}) {
  const user = await requireUser();

  // Fetch connected accounts + subscription in parallel
  const [linkedinAccounts, githubAccounts, [sub], prefs] = await Promise.all([
    db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, user.id),
          eq(connectedAccounts.platform, "linkedin")
        )
      )
      .limit(1),

    db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, user.id),
          eq(connectedAccounts.platform, "github")
        )
      )
      .limit(1),

    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1),

    // Read emailNotifications from voiceProfile._prefs
    Promise.resolve(
      (() => {
        const vp = user.voiceProfile as Record<string, unknown> | null;
        const prefs = vp?._prefs as { emailNotifications?: boolean; resumeRules?: any } | undefined;
        return { 
          emailNotifications: prefs?.emailNotifications ?? true,
          resumeRules: prefs?.resumeRules ?? []
        };
      })()
    ),
  ]);

  // Read resumeRules directly from the user row (already loaded by requireUser)
  const resumeRules = (user.resumeRules ?? null) as {
    maxPages: 1 | 2 | null;
    focus: "technical" | "creative" | "balanced" | null;
    excludeSections: string[];
    customInstruction: string | null;
  } | null;

  return (
    <div className="min-h-full pb-20 md:pb-6">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage your account, connections, and preferences
        </p>
      </div>

      <SettingsClient
        linkedinAccount={linkedinAccounts[0] ?? null}
        githubConnected={githubAccounts.length > 0}
        subscription={sub ?? null}
        plan={user.plan}
        email={user.email}
        initialEmailNotifications={prefs.emailNotifications}
        initialResumeRules={resumeRules}
        initialAutoApplyResumeUpdates={user.autoApplyResumeUpdates}
        linkedinError={searchParams?.linkedin_error ?? null}
        linkedinConnected={searchParams?.linkedin_connected === "true"}
      />
    </div>
  );
}
