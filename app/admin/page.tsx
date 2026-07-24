"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Crown,
  Zap,
  Share2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  achievementsToday: number;
  postsToday: number;
}

interface AdminUser {
  id: string;
  email: string;
  plan: string;
  isTestAccount: boolean;
  isAdmin: boolean;
  monthlyLimitOverride: number | null;
  createdAt: string;
}

interface RecentAchievement {
  id: string;
  userId: string;
  rawInput: string;
  status: string;
  resumeScore: number | null;
  createdAt: string;
  userEmail: string;
}

interface DashboardData {
  stats: Stats;
  users: AdminUser[];
  recentAchievements: RecentAchievement[];
  failedAchievements: RecentAchievement[];
  aiProvider: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const STATUS_COLORS: Record<string, string> = {
  complete: "text-emerald-400",
  processing: "text-amber-400",
  classified: "text-blue-400",
  failed: "text-red-400",
};

async function applyAction(
  id: string,
  action: "grant_pro" | "set_free" | "mark_test" | "unmark_test"
) {
  const res = await fetch(`/api/admin/users/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Action failed");
  }
}

// Legacy update (used for isAdmin toggle only)
async function updateUser(
  id: string,
  patch: { isAdmin?: boolean }
) {
  const res = await fetch(`/api/admin/users/${id}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Update failed");
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-white",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
          {label}
        </span>
        <Icon size={16} className="text-zinc-600" />
      </div>
      <div className={cn("text-3xl font-bold tabular-nums", color)}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

function PlanBadge({ user }: { user: AdminUser }) {
  if (user.plan === "pro" || user.plan === "team") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
        <Crown size={10} />
        {user.plan === "team" ? "Team" : "Pro"}
      </span>
    );
  }
  if (user.isTestAccount) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-950 text-yellow-300 border border-yellow-700">
        <Zap size={10} />
        Test
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-400">
      Free
    </span>
  );
}

function UserRow({
  user,
  onUpdated,
}: {
  user: AdminUser;
  onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(action: "grant_pro" | "set_free" | "mark_test" | "unmark_test") {
    setSaving(true);
    setErr(null);
    try {
      await applyAction(user.id, action);
      onUpdated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isPro = user.plan === "pro" || user.plan === "team";
  const isTest = user.isTestAccount;

  return (
    <tr className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
      {/* Email */}
      <td className="px-4 py-3">
        <div className="text-sm text-white font-medium">{user.email}</div>
        <div className="text-[11px] text-zinc-600 font-mono mt-0.5">
          {user.id.slice(0, 8)}…
        </div>
      </td>

      {/* Plan badge */}
      <td className="px-4 py-3">
        <PlanBadge user={user} />
      </td>

      {/* Limit */}
      <td className="px-4 py-3 text-xs text-zinc-400">
        {isPro ? (
          <span className="text-emerald-400 font-medium">∞ Pro</span>
        ) : isTest ? (
          <span className="text-yellow-400 font-medium">∞ Test</span>
        ) : user.monthlyLimitOverride === -1 ? (
          <span className="text-emerald-400">∞ override</span>
        ) : user.monthlyLimitOverride !== null ? (
          <span className="text-amber-400">{user.monthlyLimitOverride}/mo</span>
        ) : (
          <span className="text-zinc-500">3/mo (free)</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {err && (
          <p className="text-[10px] text-red-400 mb-1">{err}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {saving ? (
            <Loader2 size={13} className="animate-spin text-zinc-400" />
          ) : (
            <>
              {/* Grant Pro — only when not already Pro */}
              {!isPro && (
                <button
                  onClick={() => handle("grant_pro")}
                  title="Set plan=pro in DB — unlocks all Pro features"
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors"
                >
                  Grant Pro
                </button>
              )}

              {/* Set Free — when Pro or Test */}
              {(isPro || isTest) && (
                <button
                  onClick={() => handle("set_free")}
                  title="Reset to free plan with default limits"
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Set Free
                </button>
              )}

              {/* Mark Test — when not already test and not Pro */}
              {!isTest && !isPro && (
                <button
                  onClick={() => handle("mark_test")}
                  title="Unlimited achievements, stays Free in UI"
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-yellow-950 hover:bg-yellow-900 text-yellow-300 border border-yellow-800 transition-colors"
                >
                  Mark Test
                </button>
              )}

              {/* Remove Test */}
              {isTest && (
                <button
                  onClick={() => handle("unmark_test")}
                  title="Remove test flags, restore default limit"
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                >
                  Remove Test
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Joined */}
      <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "plan" | "email">("newest");
  const [storageStatus, setStorageStatus] = useState<
    "checking" | "ok" | "error"
  >("checking");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Check storage health
    fetch("/api/health/storage")
      .then((r) => setStorageStatus(r.ok ? "ok" : "error"))
      .catch(() => setStorageStatus("error"));
  }, [load]);

  // Filtered + sorted users
  const filteredUsers = (data?.users ?? [])
    .filter(
      (u) =>
        !search ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "plan") {
        const order = { pro: 0, team: 0, free: 1 };
        return (
          (order[a.plan as keyof typeof order] ?? 2) -
          (order[b.plan as keyof typeof order] ?? 2)
        );
      }
      if (sortBy === "email") return a.email.localeCompare(b.email);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
        <span className="text-zinc-500 text-sm">Loading admin data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle size={40} className="text-red-500" />
        <p className="text-red-400 text-sm">Failed to load: {error}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm hover:bg-zinc-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const s = data!.stats;

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Real-time overview of all users and system activity
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── A. Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Users" value={s.totalUsers} icon={Users} />
        <StatCard
          label="Pro Users"
          value={s.proUsers}
          icon={Crown}
          color="text-amber-400"
        />
        <StatCard
          label="Free Users"
          value={s.freeUsers}
          icon={Users}
          color="text-zinc-400"
        />
        <StatCard
          label="Achievements Today"
          value={s.achievementsToday}
          icon={Zap}
          color="text-blue-400"
        />
        <StatCard
          label="Posts Published Today"
          value={s.postsToday}
          icon={Share2}
          color="text-emerald-400"
        />
      </div>

      {/* ── B. User Management Table ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white">
            Users{" "}
            <span className="text-zinc-500 text-sm font-normal">
              ({filteredUsers.length})
            </span>
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                placeholder="Search email or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-56"
              />
            </div>
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "plan" | "email")
              }
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none"
            >
              <option value="newest">Sort: Newest</option>
              <option value="plan">Sort: Plan</option>
              <option value="email">Sort: Email</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Email / ID
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Monthly Limit
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Test Account
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-zinc-600 text-sm"
                    >
                      No users match your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <UserRow key={u.id} user={u} onUpdated={load} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── C. Recent Achievements ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Achievements{" "}
          <span className="text-zinc-500 text-sm font-normal">(last 20)</span>
        </h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Input Preview
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {data!.recentAchievements.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-[160px] truncate">
                      {a.userEmail}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300 max-w-xs">
                      <span
                        className="line-clamp-2"
                        title={a.rawInput}
                      >
                        {a.rawInput.slice(0, 120)}
                        {a.rawInput.length > 120 ? "…" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          STATUS_COLORS[a.status] ?? "text-zinc-400"
                        )}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums">
                      {a.resumeScore !== null ? a.resumeScore : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── D. System Health ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server size={18} className="text-zinc-500" />
          System Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* AI Provider */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              AI Provider
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-white font-semibold">
                {data!.aiProvider}
              </span>
            </div>
          </div>

          {/* Storage */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Supabase Storage
            </div>
            <div className="flex items-center gap-2">
              {storageStatus === "checking" ? (
                <>
                  <Loader2 size={14} className="animate-spin text-zinc-500" />
                  <span className="text-zinc-500 text-sm">Checking…</span>
                </>
              ) : storageStatus === "ok" ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-emerald-400 font-semibold text-sm">
                    Healthy
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-red-400 font-semibold text-sm">
                    Error
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Failed achievements */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Recent Failures
            </div>
            {data!.failedAchievements.length === 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-emerald-400 font-semibold text-sm">
                  No failures
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {data!.failedAchievements.map((a) => (
                  <div key={a.id} className="text-xs">
                    <span className="text-zinc-400">{a.userEmail}</span>
                    <span className="text-zinc-600 ml-1">
                      —{" "}
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <div className="text-red-400/70 truncate mt-0.5">
                      {a.rawInput.slice(0, 60)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
