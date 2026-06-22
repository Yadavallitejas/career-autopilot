"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Loader2,
  FileText,
  Globe,
  Linkedin,
  RotateCcw,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostStatus {
  id: string;
  platform: "linkedin" | "x";
  status: string;
  draftText: string;
}

interface AchievementStatus {
  id: string;
  status: "processing" | "classified" | "complete" | "failed";
  resumeScore: number | null;
  portfolioScore: number | null;
  classifiedResumeWorthy: boolean | null;
  classifiedPortfolioWorthy: boolean | null;
  reasoning: string | null;
  posts: PostStatus[];
  createdAt?: string;
}

interface ProgressTrackerProps {
  achievementId: string;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepKey =
  | "received"
  | "classifying"
  | "drafting"
  | "resume"
  | "portfolio";

type StepState = "pending" | "loading" | "done" | "failed";

function getStepStates(
  data: AchievementStatus | null
): Record<StepKey, StepState> {
  if (!data) {
    return {
      received: "loading",
      classifying: "pending",
      drafting: "pending",
      resume: "pending",
      portfolio: "pending",
    };
  }

  const { status } = data;

  if (status === "failed") {
    return {
      received: "done",
      classifying: "failed",
      drafting: "pending",
      resume: "pending",
      portfolio: "pending",
    };
  }

  if (status === "processing") {
    return {
      received: "done",
      classifying: "loading",
      drafting: "pending",
      resume: "pending",
      portfolio: "pending",
    };
  }

  if (status === "classified") {
    return {
      received: "done",
      classifying: "done",
      drafting: "loading",
      resume: "loading",
      portfolio: "loading",
    };
  }

  // complete
  return {
    received: "done",
    classifying: "done",
    drafting: "done",
    resume: "done",
    portfolio: "done",
  };
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepCircle({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
        <Check size={13} className="text-emerald-400" strokeWidth={2.5} />
      </span>
    );
  if (state === "loading")
    return (
      <span className="w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/40 flex items-center justify-center shrink-0 animate-pulse">
        <Loader2 size={13} className="text-yellow-400 animate-spin" />
      </span>
    );
  if (state === "failed")
    return (
      <span className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/40 flex items-center justify-center shrink-0">
        <X size={13} className="text-red-400" strokeWidth={2.5} />
      </span>
    );
  // pending
  return (
    <span className="w-7 h-7 rounded-full border border-zinc-700 flex items-center justify-center shrink-0">
      <span className="w-2 h-2 rounded-full bg-zinc-700" />
    </span>
  );
}

function StepRow({
  label,
  sub,
  state,
  isLast,
}: {
  label: string;
  sub?: string;
  state: StepState;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* Line + circle */}
      <div className="flex flex-col items-center">
        <StepCircle state={state} />
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 mt-1",
              state === "done" ? "bg-emerald-500/30" : "bg-zinc-800"
            )}
          />
        )}
      </div>

      {/* Label */}
      <div className="pb-6">
        <p
          className={cn(
            "text-sm font-medium leading-none mt-1",
            state === "done"
              ? "text-zinc-200"
              : state === "loading"
              ? "text-white"
              : state === "failed"
              ? "text-red-400"
              : "text-zinc-600"
          )}
        >
          {label}
        </p>
        {sub && state !== "pending" && (
          <p className="text-xs text-zinc-500 mt-1">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results card
// ---------------------------------------------------------------------------

function ResultsCard({
  data,
  onLogAnother,
}: {
  data: AchievementStatus;
  onLogAnother: () => void;
}) {
  const linkedinPost = data.posts.find((p) => p.platform === "linkedin");
  const resumeScore = data.resumeScore ?? 0;
  const portfolioScore = data.portfolioScore ?? 0;
  const resumeAdded = data.classifiedResumeWorthy;
  const portfolioAdded = data.classifiedPortfolioWorthy;

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xl">✅</span>
        <h3 className="text-base font-bold text-white">
          Done! Here&apos;s what we created:
        </h3>
      </div>

      {/* Score badges */}
      <div className="flex flex-wrap gap-2">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
            resumeAdded
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-zinc-800/60 border-zinc-700 text-zinc-400"
          )}
        >
          <FileText size={13} />
          <span>
            Resume:{" "}
            <span className="font-bold">{resumeScore}/10</span>
            {" — "}
            {resumeAdded ? "Added to Resume" : "Not added"}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
            portfolioAdded
              ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
              : "bg-zinc-800/60 border-zinc-700 text-zinc-400"
          )}
        >
          <Globe size={13} />
          <span>
            Portfolio:{" "}
            <span className="font-bold">{portfolioScore}/10</span>
            {" — "}
            {portfolioAdded ? "Portfolio updated" : "Not added"}
          </span>
        </div>
      </div>

      {/* Reasoning */}
      {data.reasoning && (
        <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-3">
          {data.reasoning}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {linkedinPost && (
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm"
          >
            <Link href={`/post/${linkedinPost.id}/review`}>
              <Linkedin size={15} className="mr-1.5" />
              Review LinkedIn Post →
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
        >
          <Link href="/resume">
            <FileText size={15} className="mr-1.5" />
            View Resume
          </Link>
        </Button>
      </div>

      <button
        onClick={onLogAnother}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
      >
        <Plus size={11} />
        Log another achievement
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProgressTracker({
  achievementId,
  onRetry,
}: ProgressTrackerProps) {
  const [data, setData] = useState<AchievementStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logAnother, setLogAnother] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const createdAtRef = useRef<string | null>(null);

  // Detect if stuck: processing + age > 5 min
  const [isStuck, setIsStuck] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/achievement/${achievementId}/status`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Achievement not found.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json: AchievementStatus = await res.json();
      setData(json);
      // Track createdAt for stuck detection
      if (json.createdAt && !createdAtRef.current) {
        createdAtRef.current = json.createdAt;
      }
      // Check stuck: still processing after 5+ minutes
      if (json.status === "processing" && json.createdAt) {
        const ageMs = Date.now() - new Date(json.createdAt).getTime();
        setIsStuck(ageMs > 5 * 60 * 1000);
      } else {
        setIsStuck(false);
      }
    } catch (err) {
      console.error("[ProgressTracker] poll error:", err);
      // Don't set hard error on transient network failures — keep polling
    }
  }, [achievementId]);


  useEffect(() => {
    // Immediate first fetch
    fetchStatus();

    const interval = setInterval(() => {
      setData((prev) => {
        // Stop polling once terminal state
        if (prev?.status === "complete" || prev?.status === "failed") {
          clearInterval(interval);
          return prev;
        }
        return prev;
      });
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Stop interval when terminal state reached
  useEffect(() => {
    if (data?.status === "complete" || data?.status === "failed") {
      // interval cleanup handled in the effect above via the state check
    }
  }, [data?.status]);

  if (logAnother) {
    // Signal parent to reset
    if (onRetry) onRetry();
    return null;
  }

  async function handleRetryProcessing() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/achievement/${achievementId}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Retry failed (HTTP ${res.status})`);
      }
      // Reset stuck state and let polling detect the new job
      setIsStuck(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed. Try again.";
      setRetryError(msg);
    } finally {
      setIsRetrying(false);
    }
  }

  const stepStates = getStepStates(data);

  const steps: { key: StepKey; label: string; sub?: string }[] = [
    {
      key: "received",
      label: "Achievement received",
      sub: "Saved to your account",
    },
    {
      key: "classifying",
      label: "Classifying achievement...",
      sub: "Scoring resume & portfolio fit",
    },
    {
      key: "drafting",
      label: "Drafting social posts...",
      sub: "LinkedIn post + hashtags",
    },
    {
      key: "resume",
      label: "Updating resume...",
      sub: data?.classifiedResumeWorthy
        ? `Added to ${data.resumeScore ? `section (${data.resumeScore}/10)` : "resume"}`
        : undefined,
    },
    {
      key: "portfolio",
      label: "Checking portfolio fit...",
      sub: data?.classifiedPortfolioWorthy
        ? `Portfolio score: ${data.portfolioScore}/10`
        : undefined,
    },
  ];

  return (
    <div className="max-w-lg mx-auto mt-8">
      {/* Timeline */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-zinc-400 mb-6 uppercase tracking-wider">
          Processing your achievement
        </h3>

        {error ? (
          <div className="text-center py-6">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RotateCcw size={14} className="mr-1.5" />
                Try again
              </Button>
            )}
          </div>
        ) : (
          <div>
            {steps.map((step, i) => (
              <StepRow
                key={step.key}
                label={step.label}
                sub={step.sub}
                state={stepStates[step.key]}
                isLast={i === steps.length - 1}
              />
            ))}

            {/* Stuck banner — shown only when processing > 5 minutes */}
            {isStuck && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-400 font-semibold mb-1">Taking longer than usual</p>
                <p className="text-xs text-zinc-500 mb-3">
                  This achievement has been processing for over 5 minutes. You can retry the pipeline.
                </p>
                {retryError && (
                  <p className="text-xs text-red-400 mb-2">{retryError}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRetrying}
                  onClick={handleRetryProcessing}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  {isRetrying ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin" />
                      Retrying...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <RotateCcw size={13} />
                      Retry processing
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Results card — only shown on complete */}
      {data?.status === "complete" && (
        <ResultsCard data={data} onLogAnother={() => setLogAnother(true)} />
      )}

      {/* Failed state */}
      {data?.status === "failed" && !error && (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-red-400 font-semibold mb-1">
            Something went wrong
          </p>
          <p className="text-sm text-zinc-500 mb-4">
            The AI pipeline encountered an error processing your achievement.
          </p>
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RotateCcw size={14} className="mr-1.5" />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
