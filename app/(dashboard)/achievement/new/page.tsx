import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { achievements, resumeVersions } from "@/db/schema";
import { eq, gte, and, count, sql } from "drizzle-orm";
import { AchievementForm } from "@/components/achievement/achievement-form";
import { NoResumeGate } from "@/components/achievement/no-resume-gate";
import { cookies } from "next/headers";

async function getMonthlyAchievementCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ value: count() })
    .from(achievements)
    .where(
      and(
        eq(achievements.userId, userId),
        gte(achievements.createdAt, startOfMonth)
      )
    );

  return result?.value ?? 0;
}

export default async function NewAchievementPage() {
  const user = await requireUser();

  const [resumeCheck] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(resumeVersions)
    .where(eq(resumeVersions.userId, user.id));

  const hasResume = resumeCheck.count > 0;
  const cookieStore = cookies();
  const hasOverride = cookieStore.get("resume_gate_override")?.value === "true";

  if (!hasResume && !hasOverride) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <NoResumeGate />
      </div>
    );
  }

  const monthlyCount = await getMonthlyAchievementCount(user.id);

  return (
    // Focused full-screen layout — no sidebar chrome
    <div className="min-h-screen bg-background text-foreground">
      <AchievementForm monthlyCount={monthlyCount} plan={user.plan} />
    </div>
  );
}
