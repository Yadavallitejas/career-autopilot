import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { posts, achievements } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { PostReviewCard } from "@/components/post/post-review-card";
import type { Post, Achievement } from "@/db/schema";

export const metadata = {
  title: "Review Post — Career Autopilot",
  description: "Review, edit, and publish your AI-drafted post.",
};

export default async function PostReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  // Fetch the post and join achievement in a single query
  const [row] = await db
    .select({
      post: posts,
      achievement: achievements,
    })
    .from(posts)
    .innerJoin(achievements, eq(posts.achievementId, achievements.id))
    .where(
      and(
        eq(posts.id, params.id),
        eq(achievements.userId, user.id) // ownership gate
      )
    )
    .limit(1);

  if (!row) notFound();

  const isPro = user.plan === "pro" || user.plan === "team";

  return (
    <div className="min-h-full pb-20 md:pb-6">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 inline-block"
          >
            ← Achievement Overview
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Review Post</h1>
        </div>
        <span className="text-xs text-muted-foreground/60">
          {row.post.platform === "linkedin" ? "LinkedIn" : "X / Twitter"}
        </span>
      </div>

      <PostReviewCard
        post={row.post as Post}
        achievement={row.achievement as Achievement}
        isPro={isPro}
      />
    </div>
  );
}
