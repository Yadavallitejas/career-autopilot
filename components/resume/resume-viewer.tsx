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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ResumeVersion } from "@/db/schema";
import { BuildResumeModal } from "@/components/resume/build-resume-modal";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Resume diff</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparing{" "}
              <span className="text-foreground">
                {format(new Date(previous.createdAt), "MMM d, yyyy HH:mm")}
              </span>{" "}
              â†’{" "}
              <span className="text-foreground">
                {format(new Date(current.createdAt), "MMM d, yyyy HH:mm")}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                line.kind === "same" && "text-muted-foreground"
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
        <div className="flex items-center gap-4 px-5 py-3 border-t border-border">
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <span className="w-3 h-3 rounded-sm bg-primary/20 inline-block" />
            Added
          </span>
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="w-3 h-3 rounded-sm bg-destructive/20 inline-block" />
            Removed
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-3 rounded-sm bg-muted inline-block" />
            Unchanged
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

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
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
        <FileText size={28} className="text-muted-foreground/60" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">No resume yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Upload your existing resume to start tracking versions, or build one
        from scratch and we'll generate a polished PDF.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 w-full max-w-md">
        {/* Upload card */}
        <button
          onClick={onUpload}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/10 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Upload size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Upload existing
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">PDF or DOCX</p>
          </div>
        </button>

        {/* Build card */}
        <button
          onClick={onBuild}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/10 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Build from scratch
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">AI-powered PDF</p>
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
        alert("Revert failed â€” please try again.");
      }
    } finally {
      setIsReverting(null);
    }
  }

  // Sorted versions â€” current first, then by date desc
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

      {/* â”€â”€ Split layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-4rem)]">
        {/* â”€â”€ Left: version sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <aside className="w-full md:w-[280px] md:min-w-[280px] border-b md:border-b-0 md:border-r border-border flex flex-col bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Version history
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {versions.length} version{versions.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {sortedVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  "w-full text-left px-4 py-3.5 hover:bg-muted transition-colors group",
                  selected?.id === v.id && "bg-muted"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.createdAt), "MMM d, yyyy")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {v.isCurrent && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                        Current
                      </Badge>
                    )}
                    {selected?.id === v.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </div>

                {v.changesSummary && (
                  <p className="text-xs text-foreground/90 leading-relaxed line-clamp-2 mb-2">
                    {v.changesSummary}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">
                    {format(new Date(v.createdAt), "HH:mm")} Â· {v.templateId}
                  </span>
                  {!v.isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRevert(v.id);
                      }}
                      disabled={isReverting === v.id}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-all"
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
          <div className="border-t border-border p-3 flex flex-col gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground gap-2 h-8"
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
              className="w-full justify-start text-muted-foreground hover:text-foreground gap-2 h-8"
              onClick={() => setShowBuild(true)}
            >
              <Plus size={13} />
              Build from scratch
            </Button>
          </div>
        </aside>

        {/* â”€â”€ Right: preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selected ? (
            <>
              {/* Top action bar */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-background/50 sticky top-0 z-10">
                <a
                  href={`/api/resume/${selected.id}/download`}
                  download
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                >
                  <Download size={13} />
                  Download PDF
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
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
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowDiff(true)}
                  >
                    <GitCompare size={12} />
                    Compare
                  </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {selected.isCurrent && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <CheckCircle2 size={12} />
                      Active version
                    </span>
                  )}
                  <a
                    href={selected.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* â”€â”€ Mobile: tabbed (History | Preview) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="md:hidden flex-1">
                <Tabs defaultValue="preview" className="h-full flex flex-col">
                  <TabsList className="mx-4 mt-3 mb-0 grid grid-cols-2 bg-muted">
                    <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                  </TabsList>

                  {/* Preview tab */}
                  <TabsContent value="preview" className="flex-1 p-4">
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                      <FileText size={48} className="text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        PDF preview works best on desktop.
                      </p>
                      <a
                        href={selected.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
                      >
                        Open PDF <ExternalLink size={14} />
                      </a>
                      <a
                        href={`/api/resume/${selected.id}/download`}
                        download
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-sm font-medium transition-colors"
                      >
                        <Download size={14} />
                        Download PDF
                      </a>
                    </div>
                  </TabsContent>

                  {/* History tab â€” shows the version list inline on mobile */}
                  <TabsContent value="history" className="flex-1 overflow-y-auto">
                    <div className="divide-y divide-border">
                      {sortedVersions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelected(v)}
                          className={cn(
                            "w-full text-left px-4 py-4 hover:bg-muted transition-colors",
                            selected?.id === v.id && "bg-muted"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(v.createdAt), "MMM d, yyyy")}
                            </span>
                            {v.isCurrent && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                Current
                              </Badge>
                            )}
                          </div>
                          {v.changesSummary && (
                            <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                              {v.changesSummary}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* â”€â”€ Desktop: inline iframe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="hidden md:flex flex-1 bg-muted/10">
                <iframe
                  key={selected.id}
                  src={selected.fileUrl}
                  title="Resume preview"
                  className="w-full h-[800px] border-0"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
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
