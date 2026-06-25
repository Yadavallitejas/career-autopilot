"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Sparkles, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { User } from "@/db/schema";

interface AchievementDetailProps {
  achievement: {
    id: string;
    rawInput: string;
    classifiedResumeWorthy: boolean | null;
    classifiedPortfolioWorthy: boolean | null;
    resumeScore: number | null;
    portfolioScore: number | null;
    achievementType: string | null;
    reasoning: string | null;
    resumeBullet: string | null;
    resumeSection: string | null;
    status: string;
    createdAt: Date | string;
  };
  posts: {
    id: string;
    platform: "linkedin" | "x";
    draftText: string;
    status: string;
  }[];
  user: User;
}

type ToastVariant = "success" | "error" | "default";

function FlashBanner({
  msg,
}: {
  msg: { text: string; variant: ToastVariant } | null;
}) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200",
        msg.variant === "success" &&
          "bg-emerald-950 border-emerald-500/30 text-emerald-300",
        msg.variant === "error" && "bg-red-950 border-red-500/30 text-red-300",
        msg.variant === "default" &&
          "bg-zinc-900 border-zinc-700 text-zinc-300"
      )}
    >
      {msg.variant === "success" && <CheckCircle2 size={16} />}
      {msg.variant === "error" && <AlertTriangle size={16} />}
      <span>{msg.text}</span>
    </div>
  );
}

export function AchievementDetail({
  achievement: initialAchievement,
  posts,
  user,
}: AchievementDetailProps) {
  const [achievement, setAchievement] = useState(initialAchievement);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; variant: ToastVariant } | null>(null);

  const showToast = (text: string, variant: ToastVariant = "default") => {
    setToast({ text, variant });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOverride = async (action: "add_to_resume" | "remove_from_resume") => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/achievement/${achievement.id}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Override failed", "error");
          return;
        }

        if (action === "add_to_resume") {
          setAchievement((prev) => ({
            ...prev,
            classifiedResumeWorthy: true,
            resumeBullet: data.bullet,
            resumeSection: data.section,
          }));
          showToast("Added to resume successfully!", "success");
        } else {
          setAchievement((prev) => ({
            ...prev,
            classifiedResumeWorthy: false,
          }));
          showToast("Removed from resume successfully!", "success");
        }
      } catch (err) {
        console.error(err);
        showToast("Network error. Please try again.", "error");
      }
    });
  };

  const handleCopyBullet = () => {
    if (achievement.resumeBullet) {
      navigator.clipboard.writeText(achievement.resumeBullet);
      showToast("Copied to clipboard!", "success");
    }
  };

  const handleGenerateWithTemplate = async () => {
    startTransition(async () => {
      try {
        const voice = (user.voiceProfile as { fullName?: string; jobTitle?: string; industry?: string }) || {};
        const fullName = voice.fullName || user.email.split("@")[0] || "Your Name";
        
        const resumeData = {
          fullName,
          email: user.email,
          phone: "",
          location: "",
          summary: `Results-driven professional specializing in ${voice.industry || "software development"}.`,
          experience: achievement.resumeBullet ? [
            {
              company: "Current Company",
              title: voice.jobTitle || "Professional Experience",
              startDate: "2024",
              bullets: [achievement.resumeBullet],
            }
          ] : [],
          education: [],
          skills: [],
        };

        const res = await fetch("/api/resume/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resumeData),
        });

        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Generation failed", "error");
          return;
        }

        showToast("Switched to template and generated PDF successfully!", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error(err);
        showToast("Network error. Please try again.", "error");
      }
    });
  };

  const resumeScore = achievement.resumeScore ?? 0;
  const portfolioScore = achievement.portfolioScore ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Back button */}
      <div className="flex items-center">
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-zinc-200 pl-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Achievement Details</h1>
          {achievement.achievementType && (
            <Badge variant="outline" className="bg-zinc-900 border-zinc-700 text-zinc-300 font-medium py-0.5 px-2.5 capitalize">
              {achievement.achievementType.replace("_", " ")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Logged on {new Date(achievement.createdAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2/3 width on md): Raw Input + AI reasoning + Posts */}
        <div className="md:col-span-2 space-y-6">
          {/* Raw input */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Raw Input</h3>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {achievement.rawInput}
              </p>
            </CardContent>
          </Card>

          {/* AI reasoning */}
          {achievement.reasoning && (
            <Card className="bg-zinc-900/40 border-zinc-800">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">AI Classification Reasoning</h3>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic">
                  &ldquo;{achievement.reasoning}&rdquo;
                </p>
              </CardContent>
            </Card>
          )}

          {/* Social Posts */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Share2 size={14} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Drafted Social Posts</h3>
              </div>
              
              {posts.length === 0 ? (
                <p className="text-xs text-zinc-500">No social posts drafted for this achievement.</p>
              ) : (
                <div className="grid gap-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40"
                    >
                      <div>
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded border capitalize",
                          post.platform === "linkedin"
                            ? "bg-[#0077b5]/10 border-[#0077b5]/20 text-[#0077b5]"
                            : "bg-white/5 border-zinc-700 text-zinc-300"
                        )}>
                          {post.platform}
                        </span>
                        <p className="text-xs text-zinc-500 mt-1.5 truncate max-w-[280px] sm:max-w-md">
                          {post.draftText}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="border-zinc-800 text-xs hover:bg-zinc-800">
                        <Link href={`/post/${post.id}`}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3 width on md): Scores + Override status */}
        <div className="space-y-6">
          {/* AI Scores */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Classification Scores</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-zinc-400">Resume Worthy</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      resumeScore >= 7 ? "text-emerald-400" : "text-zinc-500"
                    )}>
                      {resumeScore}/10
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", resumeScore >= 7 ? "bg-emerald-500" : "bg-zinc-600")}
                      style={{ width: `${resumeScore * 10}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-zinc-400">Portfolio Worthy</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      portfolioScore >= 6 ? "text-emerald-400" : "text-zinc-500"
                    )}>
                      {portfolioScore}/10
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", portfolioScore >= 6 ? "bg-emerald-500" : "bg-zinc-600")}
                      style={{ width: `${portfolioScore * 10}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resume status / Override */}
          <Card className="bg-zinc-900/40 border-zinc-800 overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Resume Integration</h3>
              </div>

              {user.resumeSource === "uploaded" && achievement.classifiedResumeWorthy === true ? (
                <Card className="border-amber-900 bg-amber-950/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-medium text-amber-200">We have a resume suggestion for you</div>
                    <div className="text-xs text-zinc-400">
                      Since you uploaded your own resume, we won't change its formatting automatically.
                    </div>
                    <div className="rounded bg-zinc-900 p-3 text-sm text-zinc-200">
                      <span className="text-zinc-500">Add to "{achievement.resumeSection || "Experience"}":</span><br/>
                      {achievement.resumeBullet}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="w-full border-zinc-700 text-xs font-bold hover:bg-zinc-800 hover:text-white" onClick={handleCopyBullet} disabled={isPending}>
                        Copy this text
                      </Button>
                      <Button size="sm" variant="outline" className="w-full border-zinc-700 text-xs font-bold hover:bg-zinc-800 hover:text-white" onClick={handleGenerateWithTemplate} disabled={isPending}>
                        {isPending ? (
                          <Loader2 size={13} className="animate-spin mr-1.5" />
                        ) : null}
                        Generate a new PDF with our template instead
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Tip: paste the copied text into your own resume, then re-upload it to keep it current.
                    </p>
                  </CardContent>
                </Card>
              ) : achievement.classifiedResumeWorthy === false ? (
                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/20 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Resume update was skipped</div>
                    <div className="text-xs text-zinc-500 mt-0.5">AI score: {resumeScore}/10 (threshold: 7)</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-zinc-700 text-xs font-bold hover:bg-zinc-800 hover:text-white"
                    onClick={() => handleOverride("add_to_resume")}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : null}
                    Add to resume anyway
                  </Button>
                </div>
              ) : (
                <div className="border border-emerald-900 rounded-lg p-4 bg-emerald-950/10 space-y-3">
                  <div>
                    <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Added to resume</div>
                    <div className="text-sm font-medium text-zinc-100 leading-normal">
                      {achievement.resumeBullet || achievement.rawInput}
                    </div>
                    {achievement.resumeSection && (
                      <div className="text-xs text-zinc-500 mt-2">
                        Section: <span className="font-semibold text-zinc-400">{achievement.resumeSection}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    onClick={() => handleOverride("remove_from_resume")}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : null}
                    Remove from resume
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <FlashBanner msg={toast} />
    </div>
  );
}
