"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressTracker } from "@/components/achievement/progress-tracker";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const FREE_TIER_LIMIT = 3;

// ---------------------------------------------------------------------------
// Upgrade modal
// ---------------------------------------------------------------------------

function UpgradeModal({
  used,
  onClose,
}: {
  used: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <AlertTriangle size={22} className="text-amber-400" />
        </div>

        <h2 className="text-lg font-bold text-white mb-2">
          Free tier limit reached
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          You&apos;ve used{" "}
          <span className="text-white font-semibold">{used}/{FREE_TIER_LIMIT}</span>{" "}
          achievements this month. Upgrade to Pro for unlimited achievements,
          posts, and resume updates.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            asChild
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20"
          >
            <Link href="/settings?tab=billing">
              Upgrade to Pro →
            </Link>
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline error banner
// ---------------------------------------------------------------------------

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-red-400/60 hover:text-red-300 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AchievementFormProps {
  monthlyCount: number;
  plan: "free" | "pro" | "team";
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function AchievementForm({ monthlyCount, plan }: AchievementFormProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Post-submission state
  const [achievementId, setAchievementId] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  const charCount = text.length;
  const isAtLimit = charCount >= FREE_TIER_LIMIT && plan === "free";
  const canSubmit =
    charCount >= MIN_CHARS && charCount <= MAX_CHARS && !isSubmitting;
  const charCountColor =
    charCount > MAX_CHARS
      ? "text-red-400"
      : charCount < MIN_CHARS && charCount > 0
      ? "text-amber-400"
      : "text-zinc-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Free tier gate
    if (monthlyCount >= FREE_TIER_LIMIT && plan === "free") {
      setShowUpgrade(true);
      return;
    }

    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/achievement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: text }),
      });

      if (res.status === 429) {
        // Server-side free tier block
        setShowUpgrade(true);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server error (${res.status})`);
      }

      const data: { achievementId: string; status: string } = await res.json();
      setAchievementId(data.achievementId);
      setShowTracker(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetry() {
    setShowTracker(false);
    setAchievementId(null);
    setText("");
    setError(null);
    // Focus textarea after reset
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // ---------------------------------------------------------------------------
  // Tracker view
  // ---------------------------------------------------------------------------

  if (showTracker && achievementId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Processing
          </div>
          <h1 className="text-2xl font-bold text-white">
            Achievement logged! 🚀
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Our AI is working on your LinkedIn post, resume, and portfolio.
          </p>
        </div>

        <ProgressTracker
          achievementId={achievementId}
          onRetry={handleRetry}
        />

        <div className="text-center mt-8">
          <Link
            href="/dashboard"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form view
  // ---------------------------------------------------------------------------

  return (
    <>
      {showUpgrade && (
        <UpgradeModal
          used={monthlyCount}
          onClose={() => setShowUpgrade(false)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-10"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
            What did you achieve?
          </h1>
          <p className="text-zinc-400 text-lg">
            Log it once. We handle everything else.
          </p>
        </div>

        {/* Free tier usage indicator */}
        {plan === "free" && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-zinc-600">
              This month:{" "}
              <span
                className={cn(
                  "font-semibold",
                  monthlyCount >= FREE_TIER_LIMIT
                    ? "text-amber-400"
                    : "text-zinc-400"
                )}
              >
                {monthlyCount}/{FREE_TIER_LIMIT} achievements
              </span>
            </span>
            {monthlyCount >= FREE_TIER_LIMIT && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Upgrade for unlimited →
              </button>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="achievement-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={MAX_CHARS + 50} // allow slightly over to show the counter turn red
              placeholder="e.g. Completed the AWS Solutions Architect certification after 3 weeks of study. Scored 892/1000. Focused on VPC networking, IAM, and distributed systems..."
              className={cn(
                "w-full resize-none rounded-2xl bg-zinc-900 border px-5 py-4 text-sm text-zinc-100 placeholder:text-zinc-600",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200",
                "leading-relaxed font-sans",
                charCount > MAX_CHARS
                  ? "border-red-500/50"
                  : "border-zinc-800 hover:border-zinc-700 focus:border-emerald-500/50"
              )}
              disabled={isSubmitting}
              autoFocus
            />

            {/* Character counter */}
            <div
              className={cn(
                "absolute bottom-3 right-4 text-xs tabular-nums transition-colors",
                charCountColor
              )}
            >
              {charCount} / {MAX_CHARS}
            </div>
          </div>

          {/* Guidance card */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500 leading-relaxed">
              <span className="text-zinc-400">💡 Include:</span> what it was,
              how long it took, what you learned, any numbers or metrics (e.g.
              score, hours, team size, impact)
            </p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full h-12 text-base font-bold rounded-xl transition-all duration-200",
              canSubmit
                ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Rocket size={17} />
                Log Achievement
              </span>
            )}
          </Button>
        </form>

        {/* Footer hint */}
        <p className="text-xs text-zinc-600 text-center mt-6">
          Your achievement will be classified, your LinkedIn post drafted, and
          resume updated automatically.
        </p>
      </div>
    </>
  );
}
