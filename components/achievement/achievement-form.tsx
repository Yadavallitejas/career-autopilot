"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Rocket,
  AlertTriangle,
  X,
  FileText,
  FileImage,
  Upload,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressTracker } from "@/components/achievement/progress-tracker";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const FREE_TIER_LIMIT = 3;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
};

const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(",");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(mime: string): "image" | "pdf" | "document" | null {
  return (ACCEPTED_TYPES[mime] as "image" | "pdf" | "document") ?? null;
}

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <AlertTriangle size={22} className="text-amber-400" />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-2">
          Free tier limit reached
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          You&apos;ve used{" "}
          <span className="text-foreground font-semibold">{used}/{FREE_TIER_LIMIT}</span>{" "}
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
            className="text-muted-foreground hover:text-foreground text-sm"
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
// File icon sub-component
// ---------------------------------------------------------------------------

function FileTypeIcon({ category }: { category: "image" | "pdf" | "document" | null }) {
  if (category === "pdf") {
    return (
      <div className="w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <FileText size={26} className="text-red-400" />
      </div>
    );
  }
  if (category === "document") {
    return (
      <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <FileText size={26} className="text-blue-400" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
      <FileImage size={26} className="text-emerald-400" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop upload zone
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  file: File | null;
  previewUrl: string | null;
  isDragging: boolean;
  disabled: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function UploadZone({
  file,
  previewUrl,
  isDragging,
  disabled,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onClear,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const category = file ? getFileCategory(file.type) : null;

  if (file) {
    return (
      <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/80 border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
          aria-label="Remove file"
        >
          <X size={12} />
        </button>

        <div className="flex items-start gap-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-16 h-16 rounded-xl object-cover border border-border shrink-0"
            />
          ) : (
            <FileTypeIcon category={category} />
          )}

          <div className="flex-1 min-w-0 pt-1">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(file.size)}
              <span className="mx-1 opacity-40">·</span>
              <span className="capitalize">{category ?? "file"}</span>
            </p>
            <p className="text-xs text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Ready to upload
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all duration-200 group",
        isDragging
          ? "border-emerald-500/60 bg-emerald-500/5 scale-[1.01]"
          : "border-border/60 bg-muted/20 hover:border-muted-foreground/30 hover:bg-muted/30",
        disabled && "opacity-50 pointer-events-none"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={onFileSelect}
        className="hidden"
        disabled={disabled}
      />

      <div
        className={cn(
          "w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors duration-200",
          isDragging
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-muted/40 border-border group-hover:bg-emerald-500/5 group-hover:border-emerald-500/20"
        )}
      >
        <Upload
          size={20}
          className={cn(
            "transition-colors duration-200",
            isDragging
              ? "text-emerald-400"
              : "text-muted-foreground group-hover:text-emerald-400"
          )}
        />
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {isDragging ? "Drop it here" : "Drag & drop or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          Images, PDF, or Word doc · max {MAX_FILE_SIZE_MB} MB
        </p>
      </div>
    </label>
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

  useEffect(() => {
    // Clear override cookie on component mount so that subsequent visits check again
    document.cookie = "resume_gate_override=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
  }, []);

  // Form state
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"uploading" | "processing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Post-submission state
  const [achievementId, setAchievementId] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  // Derived
  const charCount = text.length;
  const hasFile = file !== null;
  const hasText = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const canSubmit = !isSubmitting && (hasFile || hasText) && charCount <= MAX_CHARS;

  const charCountColor =
    charCount > MAX_CHARS
      ? "text-red-400"
      : charCount < MIN_CHARS && charCount > 0
      ? "text-amber-400"
      : "text-muted-foreground";

  // Dynamic button label
  const submitLabel = (() => {
    if (!hasFile && charCount < MIN_CHARS) return "Add a description or upload a file";
    if (hasFile && !hasText) return "Process Certificate";
    return "Process Achievement";
  })();

  // ── File handling ──────────────────────────────────────────────────────────

  function applyFile(selected: File) {
    if (!ACCEPTED_TYPES[selected.type]) {
      setError("Unsupported file type. Please upload an image, PDF, or Word document.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setError(null);
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected) applyFile(selected);
    e.target.value = "";
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) applyFile(dropped);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewUrl]
  );

  // ── Submit: two-step upload then create ────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (monthlyCount >= FREE_TIER_LIMIT && plan === "free") {
      setShowUpgrade(true);
      return;
    }

    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      let fileName: string | null = null;

      // STEP A — upload file
      if (file) {
        setSubmitStage("uploading");
        const uploadForm = new FormData();
        uploadForm.append("file", file);
        uploadForm.append("purpose", "achievement");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadForm,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(body?.error ?? `Upload failed (${uploadRes.status})`);
        }

        const uploadData = await uploadRes.json();
        fileUrl = uploadData.fileUrl ?? null;
        fileType = uploadData.fileType ?? null;
        fileName = uploadData.fileName ?? null;
      }

      // STEP B — create achievement record
      setSubmitStage("processing");
      const rawInput = text.trim() || `Uploaded: ${fileName ?? file?.name ?? "file"}`;

      const res = await fetch("/api/achievement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput,
          fileUrl: fileUrl ?? null,
          fileType: fileType ?? null,
          fileName: fileName ?? null,
        }),
      });

      if (res.status === 429) {
        setShowUpgrade(true);
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
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setSubmitStage(null);
    }
  }

  function handleRetry() {
    setShowTracker(false);
    setAchievementId(null);
    setText("");
    setError(null);
    clearFile();
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
          <h1 className="text-2xl font-bold text-foreground">
            Achievement logged! 🚀
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Just type naturally. Our AI will pull out structural metrics, map it
            to a category, and draft matching updates.
          </p>
        </div>

        <ProgressTracker achievementId={achievementId} onRetry={handleRetry} />

        <div className="text-center mt-8">
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Log an achievement
          </h2>
          <p className="text-muted-foreground text-lg">
            What did you accomplish today?
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── File upload zone ── */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Upload certificate, screenshot, or document{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <UploadZone
              file={file}
              previewUrl={previewUrl}
              isDragging={isDragging}
              disabled={isSubmitting}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              onClear={clearFile}
            />
          </div>

          {/* ── File-only helper tip ── */}
          {hasFile && !hasText && (
            <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
              <Sparkles size={14} className="text-sky-400 mt-0.5 shrink-0" />
              <p className="text-xs text-sky-300 leading-relaxed">
                <span className="font-semibold text-sky-200">
                  💡 We&apos;ll extract all details from your file automatically.
                </span>{" "}
                Add text only if you want to include extra context.
              </p>
            </div>
          )}

          {/* ── Textarea ── */}
          <div className="space-y-2 relative">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground/60">
                {hasFile ? "Extra context (optional)" : `Type at least ${MIN_CHARS} characters`}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  charCount > MAX_CHARS ? "text-red-400" : "text-muted-foreground"
                )}
              >
                {charCount} / {MAX_CHARS}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              id="achievement-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={MAX_CHARS + 50}
              placeholder={
                hasFile
                  ? "Add any extra context (optional)"
                  : "e.g. Completed the AWS Solutions Architect certification after 3 weeks of study. Scored 892/1000. Focused on VPC networking, IAM, and distributed systems..."
              }
              className={cn(
                "w-full resize-none rounded-2xl bg-card border px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200",
                charCount > MAX_CHARS
                  ? "border-red-500/50 focus:border-red-500/50"
                  : "border-border hover:border-muted-foreground/30 focus:border-emerald-500/50"
              )}
              disabled={isSubmitting}
              autoFocus={!hasFile}
            />
          </div>

          {/* ── Guidance card (only when no file) ── */}
          {!hasFile && (
            <div className="bg-muted/40 border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground">💡 Include:</span> what it was,
                how long it took, what you learned, any numbers or metrics (e.g.
                score, hours, team size, impact)
              </p>
            </div>
          )}

          {/* ── Submit ── */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full h-12 text-base font-bold rounded-xl transition-all duration-200",
              canSubmit
                ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-zinc-800 border-t-transparent animate-spin" />
                {submitStage === "uploading" ? "Uploading file…" : "Submitting…"}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Rocket size={17} />
                {submitLabel}
              </span>
            )}
          </Button>
        </form>

        {/* Footer hint */}
        <p className="text-xs text-muted-foreground/60 text-center mt-6">
          Your achievement will be classified, your LinkedIn post drafted, and
          resume updated automatically.
        </p>
      </div>
    </>
  );
}
