"use client";

import { useState, useRef, useTransition, Fragment } from "react";
import { format } from "date-fns";
import {
  Download,
  Upload,
  GitCompare,
  RotateCcw,
  X,
  FileText,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ResumeVersion } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Version = Pick<
  ResumeVersion,
  "id" | "fileUrl" | "rawText" | "isCurrent" | "changesSummary" | "createdAt" | "templateId"
>;

interface Props {
  versions: Version[];
  userId: string;
}

// ---------------------------------------------------------------------------
// LCS-based text diff (no external library)
// ---------------------------------------------------------------------------

type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string };

function computeDiff(aText: string, bText: string): DiffLine[] {
  const aLines = aText.split("\n");
  const bLines = bText.split("\n");
  const m = aLines.length;
  const n = bLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.push({ kind: "same", text: aLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ kind: "added", text: bLines[j - 1] });
      j--;
    } else {
      result.push({ kind: "removed", text: aLines[i - 1] });
      i--;
    }
  }
  return result.reverse();
}

// ---------------------------------------------------------------------------
// Diff modal
// ---------------------------------------------------------------------------

function DiffModal({
  current,
  previous,
  onClose,
}: {
  current: Version;
  previous: Version;
  onClose: () => void;
}) {
  const diff = computeDiff(previous.rawText, current.rawText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Resume diff</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Comparing{" "}
              <span className="text-zinc-300">
                {format(new Date(previous.createdAt), "MMM d, yyyy HH:mm")}
              </span>{" "}
              →{" "}
              <span className="text-zinc-300">
                {format(new Date(current.createdAt), "MMM d, yyyy HH:mm")}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff body */}
        <div className="flex-1 overflow-y-auto font-mono text-xs p-4 space-y-0.5">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "px-3 py-0.5 rounded select-text whitespace-pre-wrap break-all leading-5",
                line.kind === "added" && "bg-emerald-500/10 text-emerald-300",
                line.kind === "removed" &&
                  "bg-red-500/10 text-red-400 line-through",
                line.kind === "same" && "text-zinc-500"
              )}
            >
              {line.kind === "added"
                ? "+ "
                : line.kind === "removed"
                ? "- "
                : "  "}
              {line.text || " "}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-zinc-800">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/20 inline-block" />
            Added
          </span>
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <span className="w-3 h-3 rounded-sm bg-red-500/20 inline-block" />
            Removed
          </span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="w-3 h-3 rounded-sm bg-zinc-800 inline-block" />
            Unchanged
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build-from-scratch modal (multi-step form)
// ---------------------------------------------------------------------------

type BuildStep = "basic" | "experience" | "education" | "skills" | "done";

function BuildResumeModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<BuildStep>("basic");
  const [isPending, startTransition] = useTransition();

  const [basic, setBasic] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    summary: "",
  });
  const [expText, setExpText] = useState("");
  const [eduText, setEduText] = useState("");
  const [skillsText, setSkillsText] = useState("");

  const STEPS: BuildStep[] = ["basic", "experience", "education", "skills"];
  const stepIndex = STEPS.indexOf(step);

  async function handleGenerate() {
    startTransition(async () => {
      const resumeData = {
        fullName: basic.fullName,
        email: basic.email,
        phone: basic.phone || undefined,
        location: basic.location || undefined,
        summary: basic.summary || undefined,
        experience: expText
          ? [
              {
                company: "See summary",
                title: "Professional Experience",
                startDate: "2020",
                bullets: expText
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean),
              },
            ]
          : [],
        education: eduText
          ? [
              {
                institution: eduText.split("\n")[0] ?? "",
                degree: eduText.split("\n")[1] ?? "Degree",
                graduationYear: eduText.split("\n")[2] ?? "",
              },
            ]
          : [],
        certifications: [],
        projects: [],
        skills: skillsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeData),
      });

      if (res.ok) {
        setStep("done");
      }
    });
  }

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Resume generated!
          </h2>
          <p className="text-sm text-zinc-400 mb-6">
            Your resume PDF has been created. Refresh to see it in the preview.
          </p>
          <Button
            onClick={() => {
              onClose();
              window.location.reload();
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
          >
            View resume
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Build your resume
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">
              Step {stepIndex + 1} of {STEPS.length}: {step}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 gap-1.5">
          {STEPS.map((s, idx) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                idx <= stepIndex ? "bg-emerald-500" : "bg-zinc-800"
              )}
            />
          ))}
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === "basic" && (
            <>
              {(
                [
                  ["fullName", "Full name *", "Jane Doe"],
                  ["email", "Email *", "jane@example.com"],
                  ["phone", "Phone", "+91 98765 43210"],
                  ["location", "Location", "Bengaluru, India"],
                ] as [keyof typeof basic, string, string][]
              ).map(([field, label, placeholder]) => (
                <label key={field} className="block">
                  <span className="text-xs font-medium text-zinc-400 mb-1 block">
                    {label}
                  </span>
                  <input
                    type="text"
                    value={basic[field]}
                    onChange={(e) =>
                      setBasic((b) => ({ ...b, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400 mb-1 block">
                  Professional summary
                </span>
                <textarea
                  value={basic.summary}
                  onChange={(e) =>
                    setBasic((b) => ({ ...b, summary: e.target.value }))
                  }
                  placeholder="Software engineer with 5 years of experience..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                />
              </label>
            </>
          )}

          {step === "experience" && (
            <label className="block">
              <span className="text-xs font-medium text-zinc-400 mb-1 block">
                Experience bullet points (one per line)
              </span>
              <textarea
                value={expText}
                onChange={(e) => setExpText(e.target.value)}
                placeholder={
                  "Led migration of monolith to microservices, reducing deploy time by 60%\nBuilt CI/CD pipeline with GitHub Actions, cutting release cycles from 2 weeks to 2 days"
                }
                rows={8}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none font-mono text-xs leading-relaxed"
              />
            </label>
          )}

          {step === "education" && (
            <label className="block">
              <span className="text-xs font-medium text-zinc-400 mb-1 block">
                Education (institution, degree, graduation year — one per line)
              </span>
              <textarea
                value={eduText}
                onChange={(e) => setEduText(e.target.value)}
                placeholder={"IIT Bombay\nB.Tech Computer Science\n2019"}
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none font-mono text-xs"
              />
            </label>
          )}

          {step === "skills" && (
            <label className="block">
              <span className="text-xs font-medium text-zinc-400 mb-1 block">
                Skills (comma or newline separated)
              </span>
              <textarea
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder={
                  "TypeScript, React, Node.js, PostgreSQL, AWS, Docker, Kubernetes"
                }
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
              />
            </label>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              stepIndex > 0
                ? setStep(STEPS[stepIndex - 1])
                : onClose()
            }
            className="text-zinc-400"
          >
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          {step === "skills" ? (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isPending || !basic.fullName || !basic.email}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
            >
              {isPending ? (
                <>
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate PDF →"
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={step === "basic" && (!basic.fullName || !basic.email)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Next
              <ChevronRight size={13} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  onBuild,
  onUpload,
}: {
  onBuild: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
        <FileText size={28} className="text-zinc-600" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">No resume yet</h2>
      <p className="text-sm text-zinc-400 max-w-sm mb-8 leading-relaxed">
        Upload your existing resume to start tracking versions, or build one
        from scratch and we'll generate a polished PDF.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 w-full max-w-md">
        {/* Upload card */}
        <button
          onClick={onUpload}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Upload size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Upload existing
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">PDF or DOCX</p>
          </div>
        </button>

        {/* Build card */}
        <button
          onClick={onBuild}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-emerald-700/50 hover:bg-zinc-900 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
            <Plus size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Build from scratch
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">AI-powered PDF</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ResumeViewer({ versions, userId }: Props) {
  void userId;
  const [selected, setSelected] = useState<Version | null>(
    versions.find((v) => v.isCurrent) ?? versions[0] ?? null
  );
  const [showDiff, setShowDiff] = useState(false);
  const [showBuild, setShowBuild] = useState(false);
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "Upload failed");
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  // Revert handler
  async function handleRevert(versionId: string) {
    setIsReverting(versionId);
    try {
      const res = await fetch(`/api/resume/${versionId}/revert`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Revert failed — please try again.");
      }
    } finally {
      setIsReverting(null);
    }
  }

  // Sorted versions — current first, then by date desc
  const sortedVersions = [...versions].sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Find the version just before selected for diff
  const selectedIdx = sortedVersions.findIndex((v) => v.id === selected?.id);
  const previousVersion =
    selectedIdx >= 0 ? sortedVersions[selectedIdx + 1] : null;

  if (versions.length === 0) {
    return (
      <>
        <EmptyState
          onBuild={() => setShowBuild(true)}
          onUpload={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleUpload}
        />
        {showBuild && (
          <BuildResumeModal onClose={() => setShowBuild(false)} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleUpload}
      />

      {/* ── Split layout ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-4rem)]">
        {/* ── Left: version sidebar ─────────────────────────────── */}
        <aside className="w-full md:w-[280px] md:min-w-[280px] border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Version history
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              {versions.length} version{versions.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {sortedVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  "w-full text-left px-4 py-3.5 hover:bg-zinc-800/60 transition-colors group",
                  selected?.id === v.id && "bg-zinc-800/80"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">
                    {format(new Date(v.createdAt), "MMM d, yyyy")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {v.isCurrent && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        Current
                      </Badge>
                    )}
                    {selected?.id === v.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>

                {v.changesSummary && (
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2 mb-2">
                    {v.changesSummary}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">
                    {format(new Date(v.createdAt), "HH:mm")} · {v.templateId}
                  </span>
                  {!v.isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRevert(v.id);
                      }}
                      disabled={isReverting === v.id}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-all"
                    >
                      {isReverting === v.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <RotateCcw size={10} />
                      )}
                      Revert
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Add resume buttons */}
          <div className="border-t border-zinc-800 p-3 flex flex-col gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-zinc-400 hover:text-white gap-2 h-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Upload new version
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-zinc-400 hover:text-white gap-2 h-8"
              onClick={() => setShowBuild(true)}
            >
              <Plus size={13} />
              Build from scratch
            </Button>
          </div>
        </aside>

        {/* ── Right: preview ────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selected ? (
            <>
              {/* Top action bar */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950/50 sticky top-0 z-10">
                <a
                  href={`/api/resume/${selected.id}/download`}
                  download
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors"
                >
                  <Download size={13} />
                  Download PDF
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-zinc-700 hover:border-zinc-600 text-zinc-300"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={12} />
                  Upload
                </Button>

                {previousVersion && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-zinc-700 hover:border-zinc-600 text-zinc-300"
                    onClick={() => setShowDiff(true)}
                  >
                    <GitCompare size={12} />
                    Compare
                  </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {selected.isCurrent && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 size={12} />
                      Active version
                    </span>
                  )}
                  <a
                    href={selected.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* PDF iframe (desktop) / open link (mobile) */}
              <div className="flex-1 bg-zinc-900/30">
                {/* Mobile fallback */}
                <div className="md:hidden flex flex-col items-center justify-center h-48 gap-4 p-4">
                  <FileText size={40} className="text-zinc-600" />
                  <p className="text-sm text-zinc-400 text-center">
                    PDF preview is best viewed on desktop.
                  </p>
                  <a
                    href={selected.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    Open PDF <ExternalLink size={14} />
                  </a>
                </div>

                {/* Desktop iframe */}
                <iframe
                  key={selected.id}
                  src={selected.fileUrl}
                  title="Resume preview"
                  className="hidden md:block w-full h-[800px] border-0"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Select a version to preview
            </div>
          )}
        </main>
      </div>

      {/* Diff modal */}
      {showDiff && selected && previousVersion && (
        <DiffModal
          current={selected}
          previous={previousVersion}
          onClose={() => setShowDiff(false)}
        />
      )}

      {/* Build modal */}
      {showBuild && <BuildResumeModal onClose={() => setShowBuild(false)} />}
    </>
  );
}
