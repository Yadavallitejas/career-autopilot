"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  Fragment,
} from "react";
import {
  Copy,
  Check,
  Upload,
  ExternalLink,
  Loader2,
  X,
  Plus,
  Hash,
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Linkedin,
  Twitter,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Post, Achievement } from "@/db/schema";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  post: Post;
  linkedInPost?: Post | null;
  xPost?: Post | null;
  achievement: Achievement;
  isPro: boolean;
}

// ---------------------------------------------------------------------------
// Inline toast system (no external dep)
// ---------------------------------------------------------------------------

type ToastVariant = "default" | "success" | "error";
interface ToastMsg {
  id: number;
  text: string;
  variant: ToastVariant;
}

let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<ToastMsg[]>> | null = null;

function toast(text: string, variant: ToastVariant = "default") {
  _setToasts?.((prev) => [...prev, { id: ++_toastId, text, variant }]);
  setTimeout(
    () => _setToasts?.((prev) => prev.filter((t) => t.id !== _toastId)),
    3500
  );
}

function Toaster() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  _setToasts = setToasts;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border animate-in slide-in-from-bottom-4 fade-in duration-200",
            t.variant === "success" &&
              "bg-accent border-primary/20 text-accent-foreground",
            t.variant === "error" &&
              "bg-destructive/10 border-destructive/20 text-destructive",
            t.variant === "default" && "bg-card border-border text-foreground"
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character counter helpers
// ---------------------------------------------------------------------------

function CharCount({
  count,
  max,
  warn,
}: {
  count: number;
  max: number;
  warn: number;
}) {
  const isRed = count > max;
  const isYellow = count > warn && !isRed;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        isRed && "text-red-400",
        isYellow && "text-yellow-400",
        !isRed && !isYellow && "text-muted-foreground"
      )}
    >
      {count.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hashtag pills editor
// ---------------------------------------------------------------------------

function HashtagEditor({
  hashtags,
  onChange,
}: {
  hashtags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function addTag() {
    const cleaned = input
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
    if (cleaned && !hashtags.includes(cleaned)) {
      onChange([...hashtags, cleaned]);
    }
    setInput("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {hashtags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
        >
          <Hash size={10} className="text-muted-foreground/60" />
          {tag}
          <button
            onClick={() => onChange(hashtags.filter((t) => t !== tag))}
            className="ml-0.5 p-0.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={9} />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
            if (e.key === "Escape") {
              setAdding(false);
              setInput("");
            }
          }}
          onBlur={addTag}
          placeholder="tag name..."
          className="w-24 bg-muted border border-border rounded-full px-2 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground border border-border border-dashed hover:border-muted-foreground/80 hover:text-foreground transition-colors"
        >
          <Plus size={10} />
          Add tag
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fake LinkedIn preview card
// ---------------------------------------------------------------------------

function LinkedInPreview({
  text,
  hashtags,
  mediaUrl,
}: {
  text: string;
  hashtags: string[];
  mediaUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullText = `${text}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
  const preview = fullText.length > 280 && !expanded;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* LinkedIn header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/60 shrink-0 flex items-center justify-center text-foreground font-semibold text-sm select-none">
          Y
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">
            Your Name
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Career Autopilot User • 1st
          </p>
          <p className="text-[11px] text-muted-foreground/80 leading-tight">Just now</p>
        </div>
        {/* LinkedIn globe icon mock */}
        <div className="ml-auto">
          <Linkedin size={16} className="text-[#0077b5]" />
        </div>
      </div>

      {/* Post text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {preview ? fullText.slice(0, 280) + "…" : fullText}
        </p>
        {fullText.length > 280 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            {expanded ? "Show less" : "…see more"}
          </button>
        )}
      </div>

      {/* Media */}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt="Post media"
          className="w-full max-h-64 object-cover border-t border-border/50"
        />
      )}

      {/* LinkedIn reactions bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>🔁 Repost</span>
        <span>✉️ Send</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fake X/Twitter preview card
// ---------------------------------------------------------------------------

function TwitterPreview({
  text,
  thread = [],
  hashtags,
}: {
  text: string;
  thread?: string[];
  hashtags: string[];
}) {
  const mainText = hashtags.length > 0
    ? `${text}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : text;

  const tweets = [mainText, ...thread];

  return (
    <div className="space-y-2">
      {tweets.map((tw, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/60 shrink-0 flex items-center justify-center text-foreground font-semibold text-sm">
              Y
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-foreground">Your Name</span>
                <span className="text-xs text-muted-foreground">@yourhandle · now</span>
                <Twitter size={13} className="ml-auto text-[#1d9bf0]" />
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                {tw}
              </p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                <span>💬</span>
                <span>🔁</span>
                <span>❤️</span>
                <span>📤</span>
              </div>
            </div>
          </div>
          {i < tweets.length - 1 && (
            <div className="ml-[18px] mt-2 border-l border-border pl-3">
              <span className="text-[10px] text-muted-foreground">
                {i + 1}/{tweets.length}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish confirmation modal
// ---------------------------------------------------------------------------

function PublishDialog({
  text,
  hashtags,
  onConfirm,
  onCancel,
  isLoading,
}: {
  text: string;
  hashtags: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const preview = `${text}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Linkedin size={15} className="text-[#0077b5]" />
            Publish to LinkedIn
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            This is exactly what will be posted. Review it carefully.
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {preview}
            </p>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Posts cannot be edited after publishing through Career Autopilot.
            You can always edit directly on LinkedIn.
          </p>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-[#0077b5] hover:bg-[#006097] text-white font-bold"
          >
            {isLoading ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : (
              <Linkedin size={13} className="mr-1.5" />
            )}
            {isLoading ? "Publishing…" : "Publish now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved indicator
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-all",
        state === "saved" && "text-emerald-400",
        state === "saving" && "text-muted-foreground",
        state === "error" && "text-red-400",
        state === "idle" && "text-transparent"
      )}
    >
      {state === "saving" && <Loader2 size={11} className="animate-spin" />}
      {state === "saved" && <CheckCircle2 size={11} />}
      {state === "error" && <AlertTriangle size={11} />}
      <span>
        {state === "saving"
          ? "Saving…"
          : state === "saved"
          ? "Saved"
          : state === "error"
          ? "Save failed"
          : "·"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

const STATUS_MAP = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  approved: { label: "Approved", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  published: { label: "Published", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/20" },
} as const;

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Media upload helper (calls server action–style endpoint)
// ---------------------------------------------------------------------------

async function uploadPostMedia(
  postId: string,
  file: File
): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("postId", postId);

  const res = await fetch("/api/post/media", { method: "POST", body: form });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper with 2s feedback
// ---------------------------------------------------------------------------

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return { copied, copy };
}

// ---------------------------------------------------------------------------
// Resume & Portfolio card
// ---------------------------------------------------------------------------

function ResumePortfolioCard({ achievement }: { achievement: Achievement }) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);

  const {
    classifiedResumeWorthy,
    classifiedPortfolioWorthy,
    resumeScore,
    portfolioScore,
    resumeBullet,
    resumeSection,
    replaceSuggestion,
    portfolioReplaceSuggestion,
  } = achievement;

  // Don't render if classification hasn't run yet
  if (resumeScore === null && portfolioScore === null && classifiedResumeWorthy === null) {
    return null;
  }

  async function handleAddToResume() {
    setIsAdding(true);
    try {
      const res = await fetch(`/api/achievement/${achievement.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_to_resume" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error ?? "Failed to add to resume", "error");
      } else {
        toast("Added to resume ✓", "success");
        router.refresh();
      }
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Resume &amp; Portfolio
      </p>

      {/* Resume section */}
      {classifiedResumeWorthy ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-foreground">
              Resume: {resumeScore !== null ? `${resumeScore}/10` : "—"}
            </span>
          </div>
          {resumeBullet && (
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/60 rounded-lg px-3 py-2 border border-border">
              &ldquo;{resumeBullet}&rdquo;
            </p>
          )}
          {resumeSection && (
            <p className="text-[10px] text-muted-foreground/70">
              Section: <span className="font-medium text-muted-foreground">{resumeSection}</span>
            </p>
          )}
          {replaceSuggestion && (
            <p className="text-[10px] text-amber-400/80 leading-snug">
              💡 {replaceSuggestion}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-center gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs mt-1"
            onClick={handleAddToResume}
            disabled={isAdding}
          >
            {isAdding ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <FileText size={12} />
            )}
            {isAdding ? "Adding…" : "Add to Resume"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-sm text-muted-foreground">
            Resume: {resumeScore !== null ? `${resumeScore}/10` : "Not scored"}
          </span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Portfolio section */}
      {classifiedPortfolioWorthy ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="text-sm text-foreground">
              Portfolio: {portfolioScore !== null ? `${portfolioScore}/10` : "—"}
            </span>
          </div>
          {portfolioReplaceSuggestion && (
            <p className="text-[10px] text-amber-400/80 leading-snug">
              💡 {portfolioReplaceSuggestion}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-sm text-muted-foreground">
            Portfolio: {portfolioScore !== null ? `${portfolioScore}/10` : "Not scored"}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions panel (right column)
// ---------------------------------------------------------------------------

function ActionsPanel({
  postId,
  postText,
  hashtags,
  status,
  publishedUrl,
  isPro,
  saveState,
  onPublish,
  thread = [],
}: {
  postId: string;
  postText: string;
  hashtags: string[];
  status: string;
  publishedUrl: string | null;
  isPro: boolean;
  saveState: SaveState;
  onPublish: () => void;
  thread?: string[];
}) {
  const { copied, copy } = useCopyToClipboard();
  const hashtagsStr = hashtags.length > 0 ? `\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : "";
  const mainTweet = `${postText}${hashtagsStr}`;
  const fullText = thread.length > 0
    ? [mainTweet, ...thread].join("\n\n--- Thread Tweet ---\n\n")
    : mainTweet;

  return (
    <div className="flex flex-col gap-4">
      {/* Auto-save */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Status
        </span>
        <SaveIndicator state={saveState} />
      </div>

      {/* Status chip */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">Post status</span>
        <StatusChip status={status} />
      </div>

      {/* Copy */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => copy(fullText)}
        className="w-full justify-center gap-2 border-border text-foreground hover:bg-muted"
      >
        {copied ? (
          <Check size={13} className="text-emerald-400" />
        ) : (
          <Copy size={13} />
        )}
        {copied ? "Copied!" : "Copy to clipboard"}
      </Button>

      {/* Publish */}
      {status !== "published" ? (
        <div className="relative group">
          <Button
            size="sm"
            onClick={isPro ? onPublish : undefined}
            disabled={!isPro}
            className={cn(
              "w-full justify-center gap-2 font-bold",
              isPro
                ? "bg-[#0077b5] hover:bg-[#006097] text-white"
                : "bg-muted text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            <Linkedin size={13} />
            Publish to LinkedIn
          </Button>
          {!isPro && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 text-center px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
              Upgrade to Pro to publish directly
            </div>
          )}
        </div>
      ) : (
        publishedUrl && (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium transition-colors"
          >
            View on LinkedIn
            <ExternalLink size={12} />
          </a>
        )
      )}

      {/* Achievement context */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Achievement
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
          {/* achievement rawInput is passed via parent */}
          This post was generated from your logged achievement.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PostReviewCard({ post, linkedInPost, xPost, achievement, isPro }: Props) {
  const [platform, setPlatform] = useState<"linkedin" | "x">(
    post.platform === "linkedin" ? "linkedin" : "x"
  );

  function truncateTo280(text: string): string {
    if (text.length <= 280) return text;
    const truncated = text.slice(0, 280);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  }

  const [linkedInText, setLinkedInText] = useState(
    linkedInPost?.draftText ?? (post.platform === "linkedin" ? post.draftText : "")
  );
  const [xText, setXText] = useState(
    truncateTo280(xPost?.draftText ?? (post.platform === "x" ? post.draftText : ""))
  );
  const [threadTweets, setThreadTweets] = useState<string[]>(
    xPost?.thread ?? (post.platform === "x" ? post.thread : []) ?? []
  );

  const [linkedInHashtags, setLinkedInHashtags] = useState<string[]>(
    linkedInPost?.hashtags ?? (post.platform === "linkedin" ? post.hashtags : []) ?? []
  );
  const [xHashtags, setXHashtags] = useState<string[]>(
    xPost?.hashtags ?? (post.platform === "x" ? post.hashtags : []) ?? []
  );

  const [mediaUrl, setMediaUrl] = useState<string | null>(
    (post.mediaUrls ?? [])[0] ?? null
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [postStatus, setPostStatus] = useState(post.status);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    post.publishedUrl ?? null
  );
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isPublishing, startPublish] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-save (2s debounce) ───────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (postId: string, text: string, tags: string[], thread?: string[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState("saving");

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/post/${postId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftText: text, hashtags: tags, thread }),
          });
          setSaveState(res.ok ? "saved" : "error");
          setTimeout(() => setSaveState("idle"), 3000);
        } catch {
          setSaveState("error");
          setTimeout(() => setSaveState("idle"), 3000);
        }
      }, 2000);
    },
    []
  );

  function handleLinkedInTextChange(text: string) {
    setLinkedInText(text);
    const targetId = linkedInPost?.id ?? post.id;
    scheduleSave(targetId, text, linkedInHashtags);
  }

  function handleXTextChange(text: string) {
    setXText(text);
    const targetId = xPost?.id ?? post.id;
    scheduleSave(targetId, text, xHashtags, threadTweets);
  }

  function handleLinkedInHashtagsChange(tags: string[]) {
    setLinkedInHashtags(tags);
    const targetId = linkedInPost?.id ?? post.id;
    scheduleSave(targetId, linkedInText, tags);
  }

  function handleXHashtagsChange(tags: string[]) {
    setXHashtags(tags);
    const targetId = xPost?.id ?? post.id;
    scheduleSave(targetId, xText, tags, threadTweets);
  }

  function handleThreadTweetsChange(updated: string[]) {
    setThreadTweets(updated);
    const targetId = xPost?.id ?? post.id;
    scheduleSave(targetId, xText, xHashtags, updated);
  }

  // ── Media upload ─────────────────────────────────────────────────────────
  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadPostMedia(post.id, file);
      if (url) {
        setMediaUrl(url);
        toast("Image uploaded", "success");
      } else {
        toast("Upload failed — please try again", "error");
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  function handlePublishConfirm() {
    startPublish(async () => {
      try {
        const targetId = linkedInPost?.id ?? post.id;
        const res = await fetch(`/api/post/${targetId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalText: linkedInText,
            hashtags: linkedInHashtags,
            mediaUrl,
          }),
        });

        const data = (await res.json()) as
          | { publishedUrl: string; status: string }
          | { error: string; reconnect?: boolean };

        if ("error" in data) {
          if (data.reconnect) {
            toast("LinkedIn token expired — reconnect your account", "error");
          } else {
            toast(`Publish failed: ${data.error}`, "error");
          }
          setPostStatus("failed");
          return;
        }

        setPostStatus("published");
        setPublishedUrl(data.publishedUrl);
        setShowPublishDialog(false);
        toast("Published to LinkedIn! 🎉", "success");
      } catch {
        toast("Network error — please retry", "error");
      }
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const liCharCount = linkedInText.length + linkedInHashtags.join(" ").length + linkedInHashtags.length * 2;

  return (
    <>
      <Toaster />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleMediaUpload}
      />

      {/* Publish confirm dialog */}
      {showPublishDialog && (
        <PublishDialog
          text={linkedInText}
          hashtags={linkedInHashtags}
          onConfirm={handlePublishConfirm}
          onCancel={() => setShowPublishDialog(false)}
          isLoading={isPublishing}
        />
      )}

      {/* ── Platform tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-border px-4 sm:px-6">
        <div className="flex gap-1 -mb-px">
          {(["linkedin", "x"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                platform === p
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "linkedin" ? (
                <Linkedin size={14} className={platform === p ? "text-[#0077b5]" : ""} />
              ) : (
                <Twitter size={14} className={platform === p ? "text-[#1d9bf0]" : ""} />
              )}
              {p === "linkedin" ? "LinkedIn" : "X / Twitter"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main split layout ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-0 lg:min-h-[calc(100vh-12rem)]">

        {/* ── LEFT: preview + edit ─────────────────────────────────────── */}
        <div className="flex-1 lg:border-r border-border p-4 sm:p-6 space-y-5">

          {/* Preview */}
          {platform === "linkedin" ? (
            <LinkedInPreview
              text={linkedInText}
              hashtags={linkedInHashtags}
              mediaUrl={mediaUrl}
            />
          ) : (
            <TwitterPreview text={xText} thread={threadTweets} hashtags={xHashtags} />
          )}

          {/* Edit textarea */}
          {platform === "linkedin" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Edit post
                </label>
                <span className={cn(
                  "text-sm",
                  linkedInText.length > 3000 ? "text-red-500 font-medium" :  // Hard limit
                  linkedInText.length > 1300 ? "text-amber-400" :            // Engagement warning
                  "text-zinc-400"
                )}>
                  {linkedInText.length.toLocaleString()} / 3,000
                </span>
              </div>
              {linkedInText.length > 1300 && linkedInText.length <= 3000 && (
                <p className="text-xs text-amber-400 mt-1">
                  Posts under 1,300 characters tend to get higher engagement on LinkedIn.
                  Consider trimming for better reach.
                </p>
              )}
              <textarea
                value={linkedInText}
                onChange={(e) => handleLinkedInTextChange(e.target.value)}
                rows={8}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none leading-relaxed transition-colors"
                placeholder="Write your LinkedIn post here…"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Edit post
                  </label>
                  <span className={xText.length > 280 ? 'text-red-400' : 'text-zinc-400'}>
                    {xText.length} / 280
                  </span>
                </div>
                {/* Main tweet */}
                <textarea
                  value={xText}
                  onChange={(e) => handleXTextChange(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none leading-relaxed transition-colors"
                  placeholder="Write your main tweet here…"
                />
              </div>

              {/* Thread continuation tweets */}
              {threadTweets.map((tweet, i) => (
                <div key={i} className="mt-3 border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tweet {i + 2}/{threadTweets.length + 1}
                    </span>
                    <span className={tweet.length > 280 ? 'text-red-400' : 'text-zinc-400'}>
                      {tweet.length} / 280
                    </span>
                  </div>
                  <textarea
                    value={tweet}
                    onChange={(e) => {
                      const updated = [...threadTweets];
                      updated[i] = e.target.value;
                      handleThreadTweetsChange(updated);
                    }}
                    maxLength={280}
                    rows={3}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none leading-relaxed transition-colors"
                    placeholder={`Continuation tweet ${i + 2}…`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Hashtags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Hashtags
            </label>
            <HashtagEditor
              hashtags={platform === "linkedin" ? linkedInHashtags : xHashtags}
              onChange={platform === "linkedin" ? handleLinkedInHashtagsChange : handleXHashtagsChange}
            />
          </div>

          {/* Media suggestion (LinkedIn only) */}
          {platform === "linkedin" && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">💡</span>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    Suggested visual
                  </p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    {post.mediaPrompt ?? "No media suggestion available"}
                  </p>
                </div>
              </div>

              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt="Uploaded media"
                    className="w-full max-h-48 object-cover"
                  />
                  <button
                    onClick={() => setMediaUrl(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-card text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-border text-muted-foreground hover:text-foreground w-full justify-center"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  {isUploading ? "Uploading…" : "Upload image"}
                </Button>
              )}
            </div>
          )}

          {/* X note */}
          {platform === "x" && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30">
              <Clock size={13} className="text-muted-foreground/60 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                Direct publishing to X requires a paid X Developer account.
                Use the copy button to paste directly into X.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: actions ───────────────────────────────────────────── */}
        <div className="w-full lg:w-80 shrink-0 p-4 sm:p-6">
          <ActionsPanel
            postId={platform === "linkedin" ? (linkedInPost?.id ?? post.id) : (xPost?.id ?? post.id)}
            postText={platform === "linkedin" ? linkedInText : xText}
            hashtags={platform === "linkedin" ? linkedInHashtags : xHashtags}
            thread={platform === "linkedin" ? [] : threadTweets}
            status={platform === "linkedin" ? postStatus : (xPost?.status ?? "draft")}
            publishedUrl={platform === "linkedin" ? publishedUrl : null}
            isPro={isPro}
            saveState={saveState}
            onPublish={() => setShowPublishDialog(true)}
          />

          {/* Resume & Portfolio card */}
          <ResumePortfolioCard achievement={achievement} />

          {/* Achievement context card */}
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              From achievement
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
              {achievement.rawInput}
            </p>
            {achievement.achievementType && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                {achievement.achievementType}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
