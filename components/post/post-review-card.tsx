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
  Clock,
  Linkedin,
  Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Post, Achievement } from "@/db/schema";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  post: Post;
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
              "bg-emerald-950 border-emerald-500/30 text-emerald-300",
            t.variant === "error" &&
              "bg-red-950 border-red-500/30 text-red-300",
            t.variant === "default" && "bg-zinc-900 border-zinc-700 text-zinc-200"
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
        !isRed && !isYellow && "text-zinc-600"
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
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
        >
          <Hash size={10} className="text-zinc-500" />
          {tag}
          <button
            onClick={() => onChange(hashtags.filter((t) => t !== tag))}
            className="ml-0.5 p-0.5 rounded-full hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors"
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
          className="w-24 bg-zinc-800 border border-zinc-600 rounded-full px-2 py-0.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-zinc-500 border border-zinc-700 border-dashed hover:border-zinc-500 hover:text-zinc-300 transition-colors"
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
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
      {/* LinkedIn header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 shrink-0 flex items-center justify-center text-zinc-400 font-semibold text-sm select-none">
          Y
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">
            Your Name
          </p>
          <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">
            Career Autopilot User • 1st
          </p>
          <p className="text-[11px] text-zinc-600 leading-tight">Just now</p>
        </div>
        {/* LinkedIn globe icon mock */}
        <div className="ml-auto">
          <Linkedin size={16} className="text-[#0077b5]" />
        </div>
      </div>

      {/* Post text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
          {preview ? fullText.slice(0, 280) + "…" : fullText}
        </p>
        {fullText.length > 280 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-1 transition-colors"
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
          className="w-full max-h-64 object-cover border-t border-zinc-700/50"
        />
      )}

      {/* LinkedIn reactions bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-zinc-700/40 text-[11px] text-zinc-600">
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
  hashtags,
}: {
  text: string;
  hashtags: string[];
}) {
  const fullText = `${text}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;

  // Thread: split if > 280 chars
  const LIMIT = 280;
  const tweets: string[] = [];
  let remaining = fullText;
  while (remaining.length > 0) {
    if (remaining.length <= LIMIT) {
      tweets.push(remaining);
      break;
    }
    // Break at last space before limit
    const cut = remaining.lastIndexOf(" ", LIMIT);
    tweets.push(remaining.slice(0, cut > 0 ? cut : LIMIT));
    remaining = remaining.slice(cut > 0 ? cut + 1 : LIMIT);
  }

  return (
    <div className="space-y-2">
      {tweets.map((tw, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 shrink-0 flex items-center justify-center text-zinc-400 font-semibold text-sm">
              Y
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">Your Name</span>
                <span className="text-xs text-zinc-600">@yourhandle · now</span>
                <Twitter size={13} className="ml-auto text-[#1d9bf0]" />
              </div>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">
                {tw}
              </p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-600">
                <span>💬</span>
                <span>🔁</span>
                <span>❤️</span>
                <span>📤</span>
              </div>
            </div>
          </div>
          {i < tweets.length - 1 && (
            <div className="ml-[18px] mt-2 border-l border-zinc-700 pl-3">
              <span className="text-[10px] text-zinc-600">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Linkedin size={15} className="text-[#0077b5]" />
            Publish to LinkedIn
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-zinc-400">
            This is exactly what will be posted. Review it carefully.
          </p>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">
              {preview}
            </p>
          </div>
          <p className="text-xs text-zinc-600">
            Posts cannot be edited after publishing through Career Autopilot.
            You can always edit directly on LinkedIn.
          </p>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-zinc-500"
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
        state === "saving" && "text-zinc-500",
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
  draft: { label: "Draft", className: "bg-zinc-800 text-zinc-400 border-zinc-700" },
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
}: {
  postId: string;
  postText: string;
  hashtags: string[];
  status: string;
  publishedUrl: string | null;
  isPro: boolean;
  saveState: SaveState;
  onPublish: () => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const fullText = `${postText}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Auto-save */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Status
        </span>
        <SaveIndicator state={saveState} />
      </div>

      {/* Status chip */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <span className="text-sm text-zinc-400">Post status</span>
        <StatusChip status={status} />
      </div>

      {/* Copy */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => copy(fullText)}
        className="w-full justify-center gap-2 border-zinc-700 hover:border-zinc-600 text-zinc-300"
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
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            )}
          >
            <Linkedin size={13} />
            Publish to LinkedIn
          </Button>
          {!isPro && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 text-center px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Achievement
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">
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

export function PostReviewCard({ post, achievement, isPro }: Props) {
  const [platform, setPlatform] = useState<"linkedin" | "x">(
    post.platform === "linkedin" ? "linkedin" : "x"
  );
  const [editedText, setEditedText] = useState(post.draftText);
  const [editedHashtags, setEditedHashtags] = useState<string[]>(
    post.hashtags ?? []
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
    (text: string, tags: string[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState("saving");

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/post/${post.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftText: text, hashtags: tags }),
          });
          setSaveState(res.ok ? "saved" : "error");
          setTimeout(() => setSaveState("idle"), 3000);
        } catch {
          setSaveState("error");
          setTimeout(() => setSaveState("idle"), 3000);
        }
      }, 2000);
    },
    [post.id]
  );

  function handleTextChange(text: string) {
    setEditedText(text);
    scheduleSave(text, editedHashtags);
  }

  function handleHashtagsChange(tags: string[]) {
    setEditedHashtags(tags);
    scheduleSave(editedText, tags);
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
        const res = await fetch(`/api/post/${post.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalText: editedText,
            hashtags: editedHashtags,
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
  const liCharCount = editedText.length + editedHashtags.join(" ").length + editedHashtags.length * 2;
  const xCharCount = editedText.length;

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
          text={editedText}
          hashtags={editedHashtags}
          onConfirm={handlePublishConfirm}
          onCancel={() => setShowPublishDialog(false)}
          isLoading={isPublishing}
        />
      )}

      {/* ── Platform tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 px-4 sm:px-6">
        <div className="flex gap-1 -mb-px">
          {(["linkedin", "x"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                platform === p
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
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
        <div className="flex-1 lg:border-r border-zinc-800 p-4 sm:p-6 space-y-5">

          {/* Preview */}
          {platform === "linkedin" ? (
            <LinkedInPreview
              text={editedText}
              hashtags={editedHashtags}
              mediaUrl={mediaUrl}
            />
          ) : (
            <TwitterPreview text={editedText} hashtags={editedHashtags} />
          )}

          {/* Edit textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Edit post
              </label>
              <CharCount
                count={platform === "linkedin" ? liCharCount : xCharCount}
                max={platform === "linkedin" ? 2000 : 280}
                warn={platform === "linkedin" ? 1500 : 240}
              />
            </div>
            <textarea
              value={editedText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={8}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none leading-relaxed transition-colors"
              placeholder="Write your post here…"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Hashtags
            </label>
            <HashtagEditor
              hashtags={editedHashtags}
              onChange={handleHashtagsChange}
            />
          </div>

          {/* Media suggestion (LinkedIn only) */}
          {platform === "linkedin" && (
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">💡</span>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-0.5">
                    Suggested visual
                  </p>
                  <p className="text-xs text-zinc-500 italic leading-relaxed">
                    {post.mediaPrompt ?? "No media suggestion available"}
                  </p>
                </div>
              </div>

              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt="Uploaded media"
                    className="w-full max-h-48 object-cover"
                  />
                  <button
                    onClick={() => setMediaUrl(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white w-full justify-center"
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
            <div className="flex items-start gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
              <Clock size={13} className="text-zinc-600 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-600 leading-relaxed">
                Direct publishing to X requires a paid X Developer account.
                Use the copy button to paste directly into X.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: actions ───────────────────────────────────────────── */}
        <div className="w-full lg:w-80 shrink-0 p-4 sm:p-6">
          <ActionsPanel
            postId={post.id}
            postText={editedText}
            hashtags={editedHashtags}
            status={postStatus}
            publishedUrl={publishedUrl}
            isPro={isPro}
            saveState={saveState}
            onPublish={() => setShowPublishDialog(true)}
          />

          {/* Achievement context card */}
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              From achievement
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-5">
              {achievement.rawInput}
            </p>
            {achievement.achievementType && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                {achievement.achievementType}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
