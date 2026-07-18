"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Sparkles, FileText, Share2, Info } from "lucide-react";
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
    replaceSuggestion: string | null;
    portfolioReplaceSuggestion: string | null;
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
  mediaSection?: React.ReactNode;
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
          "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        msg.variant === "error" && "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
        msg.variant === "default" &&
          "bg-muted border-border text-muted-foreground"
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
  mediaSection,
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

  const resumeScore = achievement.resumeScore;
  const portfolioScore = achievement.portfolioScore;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Back button */}
      <div className="flex items-center">
        <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground pl-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Achievement Details</h1>
          {achievement.achievementType && (
            <Badge variant="outline" className="bg-muted border-border text-muted-foreground font-medium py-0.5 px-2.5 capitalize">
              {achievement.achievementType.replace("_", " ")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Logged on {new Date(achievement.createdAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2/3 width on md): Raw Input + AI reasoning + Posts */}
        <div className="md:col-span-2 space-y-6">
          {/* Raw input */}
          <Card className="bg-card/40 border-border">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Raw Input</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {achievement.rawInput}
              </p>
            </CardContent>
          </Card>

          {/* Media Section */}
          {mediaSection}

          {/* AI reasoning */}
          {achievement.reasoning && (
            <Card className="bg-card/40 border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Classification Reasoning</h3>
                </div>
                <p className="text-sm text-foreground leading-relaxed italic">
                  &ldquo;{achievement.reasoning}&rdquo;
                </p>
              </CardContent>
            </Card>
          )}

          {/* Social Posts */}
          <Card className="bg-card/40 border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Share2 size={14} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drafted Social Posts</h3>
              </div>
              
              {posts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No social posts drafted for this achievement.</p>
              ) : (
                <div className="grid gap-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/40"
                    >
                      <div>
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded border capitalize",
                          post.platform === "linkedin"
                            ? "bg-[#0077b5]/10 border-[#0077b5]/20 text-[#0077b5]"
                            : "bg-muted border-border text-muted-foreground"
                        )}>
                          {post.platform}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1.5 truncate max-w-[280px] sm:max-w-md">
                          {post.draftText}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="border-border text-xs hover:bg-accent">
                        <Link href={`/post/${post.id}/review`}>
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
          <Card className="bg-card/40 border-border">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classification Scores</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Resume Worthy</span>
                    {resumeScore === null ? (
                      <Link
                        href="/resume"
                        className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Connect resume ↗
                      </Link>
                    ) : (
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        resumeScore >= 7 ? "text-emerald-400" : "text-muted-foreground"
                      )}>
                        {resumeScore}/10
                      </span>
                    )}
                  </div>
                  {resumeScore === null ? (
                    <p className="text-xs text-muted-foreground">Upload your resume for personalized scoring.</p>
                  ) : (
                    <>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", resumeScore >= 7 ? "bg-emerald-500" : "bg-zinc-500")}
                          style={{ width: `${resumeScore * 10}%` }}
                        />
                      </div>
                      {achievement.replaceSuggestion && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-1.5">
                          💡 {achievement.replaceSuggestion}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Portfolio Worthy</span>
                    {portfolioScore === null ? (
                      <Link
                        href="/portfolio"
                        className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Connect portfolio ↗
                      </Link>
                    ) : (
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        portfolioScore >= 6 ? "text-emerald-400" : "text-muted-foreground"
                      )}>
                        {portfolioScore}/10
                      </span>
                    )}
                  </div>
                  {portfolioScore === null ? (
                    <p className="text-xs text-muted-foreground">Connect your portfolio for personalized scoring.</p>
                  ) : (
                    <>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", portfolioScore >= 6 ? "bg-emerald-500" : "bg-zinc-500")}
                          style={{ width: `${portfolioScore * 10}%` }}
                        />
                      </div>
                      {achievement.portfolioReplaceSuggestion && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-1.5">
                          💡 {achievement.portfolioReplaceSuggestion}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resume status / Override */}
          <Card className="bg-card/40 border-border overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resume Integration</h3>
              </div>

              {achievement.classifiedResumeWorthy === true ? (
                <div className="border border-emerald-500/20 rounded-lg p-4 bg-emerald-500/5 space-y-3">
                  <div>
                    <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Added to resume</div>
                    <div className="text-sm font-medium text-foreground leading-normal">
                      {achievement.resumeBullet || achievement.rawInput}
                    </div>
                    {achievement.resumeSection && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Section: <span className="font-semibold text-foreground">{achievement.resumeSection}</span>
                      </div>
                    )}
                  </div>

                  {/* Info note for uploaded-resume users */}
                  {user.resumeSource === "uploaded" && (
                    <div className="flex items-start gap-2 bg-sky-500/8 border border-sky-500/20 rounded-lg px-3 py-2.5">
                      <Info size={13} className="text-sky-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-sky-300 leading-relaxed">
                        We&apos;ve extracted your resume content and generated an updated PDF automatically.
                        Your original file is preserved — download the new version from the{" "}
                        <Link href="/resume" className="underline underline-offset-2 hover:text-sky-200 transition-colors">Resume page</Link>.
                      </p>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs font-semibold text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    onClick={() => handleOverride("remove_from_resume")}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : null}
                    Remove from resume
                  </Button>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Resume update was skipped</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      AI score: {resumeScore !== null ? `${resumeScore}/10` : "N/A"} (threshold: 7)
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-border text-xs font-bold hover:bg-accent hover:text-foreground"
                    onClick={() => handleOverride("add_to_resume")}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 size={13} className="animate-spin mr-1.5" />
                    ) : null}
                    Add to resume anyway
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
