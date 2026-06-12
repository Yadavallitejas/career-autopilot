import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import {
  achievements,
  posts,
  resumeVersions,
} from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { format } from "date-fns";
import { Rocket, Plus, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Achievement, Post } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AchievementWithPosts = Achievement & { posts: Post[] };

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

async function getDashboardData(userId: string) {
  const [
    [achievementCount],
    [postCount],
    [resumeCount],
    recentAchievements,
  ] = await Promise.all([
    // Total achievements
    db
      .select({ value: count() })
      .from(achievements)
      .where(eq(achievements.userId, userId)),

    // Total drafted posts
    db
      .select({ value: count() })
      .from(posts)
      .innerJoin(achievements, eq(posts.achievementId, achievements.id))
      .where(eq(achievements.userId, userId)),

    // Resume versions
    db
      .select({ value: count() })
      .from(resumeVersions)
      .where(eq(resumeVersions.userId, userId)),

    // Last 5 achievements with posts
    db.query.achievements.findMany({
      where: eq(achievements.userId, userId),
      orderBy: [desc(achievements.createdAt)],
      limit: 5,
      with: { posts: true },
    }),
  ]);

  return {
    achievementCount: achievementCount?.value ?? 0,
    postCount: postCount?.value ?? 0,
    resumeCount: resumeCount?.value ?? 0,
    recentAchievements: recentAchievements as AchievementWithPosts[],
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="pb-2 pt-5 px-5">
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Skeleton className="h-8 w-16 mt-1" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<
  string,
  { label: string; className: string; pulse?: boolean }
> = {
  processing: {
    label: "Processing",
    className:
      "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    pulse: true,
  },
  classified: {
    label: "Classified",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  },
  complete: {
    label: "Complete",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "border-red-500/40 bg-red-500/10 text-red-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] ?? {
    label: status,
    className: "border-zinc-700 bg-zinc-800 text-zinc-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border",
        cfg.className
      )}
    >
      {cfg.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
      )}
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-zinc-600 text-xs">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty state (CSS-art illustration, no images)
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      {/* CSS geometric illustration */}
      <div className="relative w-32 h-32 mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        {/* Inner circles */}
        <div className="absolute inset-4 rounded-full border border-zinc-700" />
        <div className="absolute inset-8 rounded-full bg-zinc-800/60 border border-zinc-700" />
        {/* Rocket icon center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Rocket size={18} className="text-emerald-400" />
          </div>
        </div>
        {/* Orbiting dots */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-zinc-600" />
        <div className="absolute top-1/2 right-1 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-zinc-700" />
      </div>

      <h2 className="text-xl font-bold text-white mb-2">
        Your career story starts here
      </h2>
      <p className="text-sm text-zinc-400 max-w-sm mb-8 leading-relaxed">
        Log your first achievement and we&apos;ll automatically draft your
        LinkedIn post, update your resume, and keep your portfolio fresh.
      </p>
      <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20">
        <Link href="/achievement/new">
          <Plus size={16} className="mr-1.5" />
          Log your first achievement →
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Achievements Table
// ---------------------------------------------------------------------------

function RecentTable({
  achievements,
}: {
  achievements: AchievementWithPosts[];
}) {
  if (achievements.length === 0) return <EmptyState />;

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Achievement</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {achievements.map((a) => {
            const linkedinPost = a.posts.find(
              (p) => p.platform === "linkedin"
            );
            return (
              <TableRow key={a.id} className="border-zinc-800">
                {/* Date */}
                <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                  {format(new Date(a.createdAt), "MMM d, yy")}
                </TableCell>

                {/* Type badge */}
                <TableCell>
                  <TypeBadge type={a.achievementType} />
                </TableCell>

                {/* Input preview (hidden on xs) */}
                <TableCell className="hidden sm:table-cell max-w-[260px]">
                  <p className="text-sm text-zinc-300 truncate">
                    {a.rawInput.length > 60
                      ? a.rawInput.slice(0, 60) + "…"
                      : a.rawInput}
                  </p>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  {linkedinPost ? (
                    <Link
                      href={`/post/${linkedinPost.id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      Review post
                      <ExternalLink size={11} />
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/40">
        <div className="flex gap-8">
          {["w-12", "w-16", "w-48", "w-20", "w-20"].map((w, i) => (
            <Skeleton key={i} className={cn("h-3", w)} />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-zinc-800 last:border-0 flex items-center gap-8">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-48 hidden sm:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const user = await requireUser();
  const { achievementCount, postCount, resumeCount, recentAchievements } =
    await getDashboardData(user.id);

  const lastUpdated =
    recentAchievements.length > 0
      ? format(new Date(recentAchievements[0].createdAt), "MMM d, yyyy")
      : "Never";

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
      {/* ── Top row: quick-add + stats ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Overview</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {achievementCount === 0
              ? "Start by logging your first achievement"
              : `${achievementCount} achievement${achievementCount !== 1 ? "s" : ""} logged`}
          </p>
        </div>
        <Button
          asChild
          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-md shadow-emerald-500/15 shrink-0"
        >
          <Link href="/achievement/new">
            <Rocket size={15} className="mr-2" />
            Log Achievement →
          </Link>
        </Button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Achievements"
            value={achievementCount}
            sub="Total logged"
          />
          <StatCard
            label="Posts drafted"
            value={postCount}
            sub="LinkedIn + X"
          />
          <StatCard
            label="Resume versions"
            value={resumeCount}
            sub={resumeCount > 0 ? "Active tracking" : "None yet"}
          />
          <StatCard
            label="Last updated"
            value={lastUpdated}
            sub="Most recent entry"
          />
        </div>
      </Suspense>

      {/* ── Recent achievements ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">
            Recent Achievements
          </h3>
          {achievementCount > 5 && (
            <Link
              href="/achievement"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              View all →
            </Link>
          )}
        </div>

        <Suspense fallback={<TableSkeleton />}>
          <RecentTable achievements={recentAchievements} />
        </Suspense>
      </div>
    </div>
  );
}
