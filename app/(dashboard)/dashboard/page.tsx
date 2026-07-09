import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  users,
  achievements,
  posts,
  resumeVersions,
} from "@/db/schema";
import { db } from "@/db";
import { eq, desc, count, and, gte, sql } from "drizzle-orm";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Achievement, Post } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AchievementWithPosts = Achievement & { posts: Post[] };

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

async function getDashboardData(userId: string, startOfMonth: Date) {
  return Promise.all([
    // 1. Total achievements (all statuses)
    db
      .select({ value: count() })
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .then(([r]) => r?.value ?? 0),

    // 2. Total drafted posts
    db
      .select({ value: count() })
      .from(posts)
      .innerJoin(achievements, eq(posts.achievementId, achievements.id))
      .where(eq(achievements.userId, userId))
      .then(([r]) => r?.value ?? 0),

    // 3. Resume versions
    db
      .select({ value: count() })
      .from(resumeVersions)
      .where(eq(resumeVersions.userId, userId))
      .then(([r]) => r?.value ?? 0),

    // 4. Completed achievements this calendar month (free-tier gate)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(achievements)
      .where(
        and(
          eq(achievements.userId, userId),
          eq(achievements.status, 'complete'),
          gte(achievements.createdAt, startOfMonth)
        )
      )
      .then(([r]) => r?.count ?? 0),

    // 5. Last 5 achievements with posts
    db.query.achievements.findMany({
      where: eq(achievements.userId, userId),
      orderBy: [desc(achievements.createdAt)],
      limit: 5,
      with: { posts: true },
    }) as Promise<AchievementWithPosts[]>,
  ]);
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
    <Card className="bg-card/60 border-border hover:border-muted-foreground/30 transition-colors">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const FREE_LIMIT = 3;

function MonthlyUsageCard({
  monthlyCount,
  plan,
}: {
  monthlyCount: number;
  plan: "free" | "pro" | "team";
}) {
  return (
    <Card className={cn("border", monthlyCount >= 3 && plan === 'free' ? "border-destructive bg-destructive/10" : "border-border")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Monthly achievements</span>
          {plan === 'free' && (
            <Badge variant="outline" className="text-xs border-border text-muted-foreground">Free</Badge>
          )}
        </div>
        {plan === 'free' ? (
          <>
            <div className="text-2xl font-bold text-foreground">{monthlyCount}/{3}</div>
            <Progress value={(monthlyCount / 3) * 100} className="mt-2 h-1.5" />
            {monthlyCount >= 3 ? (
              <p className="text-xs text-destructive mt-2">
                Limit reached — <Link href="/settings?tab=billing" className="underline hover:text-red-400 transition-colors">upgrade to Pro</Link>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">{3 - monthlyCount} remaining this month</p>
            )}
          </>
        ) : (
          <div className="text-2xl font-bold text-foreground">{monthlyCount} <span className="text-sm font-normal text-muted-foreground">this month</span></div>
        )}
      </CardContent>
    </Card>
  );
}


function StatCardSkeleton() {
  return (
    <Card className="bg-card/60 border-border">
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
    className: "border-border bg-muted text-muted-foreground",
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

// Check if type exists
function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground/60 text-xs">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
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
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        {/* Inner circles */}
        <div className="absolute inset-4 rounded-full border border-border/80" />
        <div className="absolute inset-8 rounded-full bg-muted/60 border border-border" />
        {/* Rocket icon center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Rocket size={18} className="text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>
        {/* Orbiting dots */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-muted-foreground/40" />
        <div className="absolute top-1/2 right-1 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-muted-foreground/30" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        Your career story starts here
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Log your first achievement and we&apos;ll automatically draft your
        LinkedIn post, update your resume, and keep your portfolio fresh.
      </p>
      <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20">
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
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
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
              <TableRow key={a.id} className="border-border">
                {/* Date */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(a.createdAt), "MMM d, yy")}
                </TableCell>

                {/* Type badge */}
                <TableCell>
                  <TypeBadge type={a.achievementType} />
                </TableCell>

                {/* Input preview (hidden on xs) */}
                <TableCell className="hidden sm:table-cell max-w-[260px]">
                  <Link href={`/achievement/${a.id}`} className="hover:underline transition-colors hover:text-emerald-400">
                    <p className="text-sm text-foreground truncate">
                      {a.rawInput.length > 60
                        ? a.rawInput.slice(0, 60) + "…"
                        : a.rawInput}
                    </p>
                  </Link>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  {linkedinPost ? (
                    <Link
                      href={`/post/${linkedinPost.id}/review`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      Review post
                      <ExternalLink size={11} />
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
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
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex gap-8">
          {["w-12", "w-16", "w-48", "w-20", "w-20"].map((w, i) => (
            <Skeleton key={i} className={cn("h-3", w)} />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-border last:border-0 flex items-center gap-8">
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
  // Auth is synchronous (reads cookie) — use it to get clerkId instantly,
  // then fire user resolution + all DB queries in parallel.
  const { userId: clerkId } = auth();
  if (!clerkId) redirect('/sign-in');

  // Start of current calendar month — computed once here
  // so getDashboardData doesn't need to redo it
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Resolve DB user row in parallel with a temporary fetch scoped to clerkId.
  // We can't start the userId-scoped queries until we have user.id, so we
  // resolve the user first, then kick off all data in parallel.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) redirect('/sign-in');

  // All 5 dashboard queries fire in parallel — single round-trip to Neon
  const [
    achievementCount,
    postCount,
    resumeCount,
    monthlyCompletedCount,
    recentAchievements,
  ] = await getDashboardData(user.id, startOfMonth);

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
      {/* ── Top row: quick-add + stats ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {achievementCount === 0
              ? "Start by logging your first achievement"
              : `${achievementCount} achievement${achievementCount !== 1 ? "s" : ""} logged`}
          </p>
        </div>
        <Button
          asChild
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-md shadow-emerald-500/15 shrink-0"
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
          <MonthlyUsageCard
            monthlyCount={monthlyCompletedCount}
            plan={user.plan}
          />
        </div>
      </Suspense>

      {/* ── Recent achievements ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Recent Achievements
          </h3>
          {achievementCount > 5 && (
            <Link
              href="/achievement"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
