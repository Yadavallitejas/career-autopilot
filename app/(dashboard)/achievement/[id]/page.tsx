import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { achievements, posts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AchievementDetail } from "@/components/achievement/achievement-detail";
import { Paperclip } from "lucide-react";

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
        user={user}
        mediaSection={
          achievement.mediaUrl ? (
            <div className="border border-border bg-card/40 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attached {achievement.mediaType === "pdf" ? "document" : "image"}
              </div>
              {achievement.mediaType === "pdf" ? (
                <a
                  href={achievement.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline inline-block"
                >
                  View uploaded certificate →
                </a>
              ) : (
                <img
                  src={achievement.mediaUrl}
                  alt="Achievement attachment"
                  className="max-h-40 rounded border border-border object-contain"
                />
              )}
              <p className="text-xs text-muted-foreground">
                This document's content was used to classify your achievement.
              </p>
            </div>
          ) : null
        }
      />
    </div>
  );
}
