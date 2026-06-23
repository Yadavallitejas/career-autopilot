import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { achievements, posts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AchievementDetail } from "@/components/achievement/achievement-detail";

export const metadata = {
  title: "Achievement Details — Career Autopilot",
  description: "View and edit details, AI classification, and social drafts for this career achievement.",
};

interface PageProps {
  params: {
    id: string;
  };
}

export default async function AchievementDetailPage({ params }: PageProps) {
  const user = await requireUser();

  // Fetch achievement
  const [achievement] = await db
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.id, params.id),
        eq(achievements.userId, user.id)
      )
    )
    .limit(1);

  if (!achievement) {
    notFound();
  }

  // Fetch associated posts
  const postRows = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      draftText: posts.draftText,
      status: posts.status,
    })
    .from(posts)
    .where(eq(posts.achievementId, achievement.id));

  return (
    <div className="h-full pb-20 md:pb-0">
      <AchievementDetail
        achievement={achievement}
        posts={postRows}
      />
    </div>
  );
}
