import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { achievements } from "@/db/schema";
import { eq, gte, and, count } from "drizzle-orm";
import { AchievementForm } from "@/components/achievement/achievement-form";

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
  const monthlyCount = await getMonthlyAchievementCount(user.id);

  return (
    // Focused full-screen layout — no sidebar chrome
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AchievementForm monthlyCount={monthlyCount} plan={user.plan} />
    </div>
  );
}
