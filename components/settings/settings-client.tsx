"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Linkedin,
  Github,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  Trash2,
  CreditCard,
  Crown,
  Calendar,
  Zap,
  ChevronRight,
  LogOut,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/nextjs";
import type { ConnectedAccount, Subscription } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResumeRulesData {
  maxPages: 1 | 2 | null;
  focus: "technical" | "creative" | "balanced" | null;
  excludeSections: string[];
  customInstruction: string | null;
}

interface Props {
  linkedinAccount: ConnectedAccount | null;
  githubConnected: boolean;
  subscription: Subscription | null;
  plan: "free" | "pro" | "team";
  email: string;
  linkedinError?: string | null;
  linkedinConnected?: boolean;
  initialResumeRules?: ResumeRulesData | null;
}

// ---------------------------------------------------------------------------
// Inline toast (self-contained, no external dep)
// ---------------------------------------------------------------------------

type ToastVariant = "success" | "error" | "default";

function useFlash() {
  const [msg, setMsg] = useState<{ text: string; variant: ToastVariant } | null>(null);

  function flash(text: string, variant: ToastVariant = "default") {
    setMsg({ text, variant });
    setTimeout(() => setMsg(null), 3500);
  }

  return { msg, flash };
}

function FlashBanner({
  msg,
}: {
  msg: { text: string; variant: ToastVariant } | null;
}) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border animate-in slide-in-from-bottom-4 fade-in duration-200",
        msg.variant === "success" &&
          "bg-accent border-primary/20 text-accent-foreground",
        msg.variant === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
        msg.variant === "default" &&
          "bg-card border-border text-foreground"
      )}
    >
      {msg.text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-6 space-y-5",
        danger
          ? "border-destructive/30 bg-destructive/5"
          : ""
      )}
    >
      <div>
        <h2
          className={cn(
            "text-base font-semibold",
            danger ? "text-destructive" : "text-foreground"
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 1. CONNECTED ACCOUNTS
// ---------------------------------------------------------------------------

const LI_SCOPES = "openid profile email w_member_social";

function ConnectedAccountsSection({
  linkedinAccount,
  githubConnected,
  onFlash,
}: {
  linkedinAccount: ConnectedAccount | null;
  githubConnected: boolean;
  onFlash: (text: string, variant: ToastVariant) => void;
}) {
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isDisconnectingGithub, startDisconnectGithub] = useTransition();
  const router = useRouter();

  function buildLinkedInOAuthUrl() {
    const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID ?? "";
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/api/connected-accounts/linkedin`
    );
    const scope = encodeURIComponent(LI_SCOPES);
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  }

  function handleConnect() {
    window.location.href = buildLinkedInOAuthUrl();
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      const res = await fetch("/api/connected-accounts/linkedin", {
        method: "DELETE",
      });
      if (res.ok) {
        onFlash("LinkedIn disconnected", "default");
        router.refresh();
      } else {
        onFlash("Failed to disconnect — please try again", "error");
      }
    });
  }

  function handleDisconnectGithub() {
    startDisconnectGithub(async () => {
      const res = await fetch("/api/connected-accounts/github", {
        method: "DELETE",
      });
      if (res.ok) {
        onFlash("GitHub disconnected", "default");
        router.refresh();
      } else {
        onFlash("Failed to disconnect — please try again", "error");
      }
    });
  }

  return (
    <Section
      title="Connected Accounts"
      description="Link external accounts for publishing and portfolio deployment."
    >
      {/* LinkedIn */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0077b5]/10 border border-[#0077b5]/20 flex items-center justify-center shrink-0">
            <Linkedin size={18} className="text-[#0077b5]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">LinkedIn</p>
            {linkedinAccount ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs text-muted-foreground">
                  {linkedinAccount.platformUsername ?? "Connected"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">Not connected</p>
            )}
          </div>
        </div>

        {linkedinAccount ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
          >
            {isDisconnecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <X size={12} />
            )}
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            className="bg-[#0077b5] hover:bg-[#006097] text-white text-xs font-bold"
          >
            Connect LinkedIn
          </Button>
        )}
      </div>

      {/* GitHub */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            <Github size={18} className="text-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">GitHub</p>
            {githubConnected ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">Not connected</p>
            )}
          </div>
        </div>

        {githubConnected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDisconnectGithub}
            disabled={isDisconnectingGithub}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
          >
            {isDisconnectingGithub ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <X size={12} />
            )}
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            asChild
            variant="outline"
            className="text-xs font-bold"
          >
            <a href="/api/portfolio/github-auth">Connect GitHub</a>
          </Button>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 2. RESUME PREFERENCES
// ---------------------------------------------------------------------------

const FOCUS_OPTIONS = [
  { value: "technical", label: "Technical / ATS", desc: "Keywords, metrics, stack names" },
  { value: "creative", label: "Creative / Human", desc: "Natural language, story-driven" },
  { value: "balanced", label: "Balanced", desc: "Best of both worlds" },
] as const;

const EXCLUDE_SECTION_OPTIONS = ["Skills", "Projects", "Certifications", "Summary", "Awards"] as const;

function ResumePreferencesSection({
  initial,
  onFlash,
}: {
  initial: ResumeRulesData | null;
  onFlash: (text: string, variant: ToastVariant) => void;
}) {
  const [maxPages, setMaxPages] = useState<1 | 2 | null>(initial?.maxPages ?? null);
  const [focus, setFocus] = useState<"technical" | "creative" | "balanced" | null>(
    initial?.focus ?? null
  );
  const [excludeSections, setExcludeSections] = useState<string[]>(
    initial?.excludeSections ?? []
  );
  const [customInstruction, setCustomInstruction] = useState<string>(
    initial?.customInstruction ?? ""
  );
  const [isSaving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggleExclude(section: string) {
    setExcludeSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  }

  function handleSave() {
    startSave(async () => {
      try {
        const res = await fetch("/api/user/resume-rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxPages,
            focus,
            excludeSections,
            customInstruction: customInstruction.trim() || null,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onFlash("Resume preferences saved", "success");
      } catch {
        onFlash("Failed to save preferences — please try again", "error");
      }
    });
  }

  return (
    <Section
      title="Resume Preferences"
      description="These rules guide how the AI builds and updates your resume. Applied on every automatic update."
    >
      {/* Page length */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Resume length</p>
        <div className="flex flex-wrap gap-2">
          {([
            { v: 1 as const, label: "1 page", sub: "< 5 yrs experience" },
            { v: 2 as const, label: "2 pages", sub: "5+ yrs experience" },
            { v: null, label: "No limit", sub: "Let AI decide" },
          ] as const).map(({ v, label, sub }) => {
            const isSelected = maxPages === v;
            return (
              <button
                key={String(v)}
                onClick={() => setMaxPages(v)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border transition-colors text-left",
                  isSelected
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs mt-0.5 opacity-70">{sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Writing style */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Writing style</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FOCUS_OPTIONS.map((opt) => {
            const isSelected = focus === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFocus(focus === opt.value ? null : opt.value)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border transition-colors text-left",
                  isSelected
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs mt-0.5 opacity-70">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exclude sections */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Skip these sections</p>
        <p className="text-xs text-muted-foreground/60 mb-2.5">AI will not place bullets in these sections.</p>
        <div className="flex flex-wrap gap-2">
          {EXCLUDE_SECTION_OPTIONS.map((s) => {
            const isSelected = excludeSections.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleExclude(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  isSelected
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {isSelected ? "✕ " : ""}{s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom instruction */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Custom instructions</p>
        <textarea
          rows={3}
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder="e.g. Always include my GitHub link. Never add GPA. Focus on leadership when relevant."
          maxLength={500}
          className="w-full bg-card border border-border hover:border-muted-foreground/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none transition-colors"
        />
        <p className="text-xs text-muted-foreground/60 mt-1">
          {customInstruction.length}/500 — The AI follows these on every resume update
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm gap-2"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={14} />
          ) : (
            <FileText size={14} />
          )}
          {saved ? "Saved!" : "Save preferences"}
        </Button>
        {saved && (
          <p className="text-xs text-emerald-400">Applied on the next resume update</p>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3. PLAN & BILLING
// ---------------------------------------------------------------------------

function CancelDialog({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle size={18} className="text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Cancel subscription?</h3>
            <p className="text-xs text-muted-foreground">You'll keep Pro until the end of your billing period.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading} className="flex-1 text-muted-foreground hover:text-foreground">
            Keep Pro
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            variant="destructive"
            className="flex-1 font-semibold"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : "Yes, cancel"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PlanBillingSection({
  plan,
  subscription,
  onFlash,
}: {
  plan: "free" | "pro" | "team";
  subscription: Subscription | null;
  onFlash: (text: string, variant: ToastVariant) => void;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [isCancelling, startCancel] = useTransition();
  const router = useRouter();

  const isPro = plan === "pro" || plan === "team";

  async function handleCancel() {
    startCancel(async () => {
      // Call Razorpay cancel + update DB
      const res = await fetch("/api/payments/cancel", { method: "POST" });
      if (res.ok) {
        onFlash("Subscription cancelled — you'll keep Pro until period end", "default");
        setShowCancel(false);
        router.refresh();
      } else {
        onFlash("Cancellation failed — contact support", "error");
      }
    });
  }

  return (
    <>
      {showCancel && (
        <CancelDialog
          onConfirm={handleCancel}
          onCancel={() => setShowCancel(false)}
          isLoading={isCancelling}
        />
      )}

      <Section
        title="Plan & Billing"
        description="Manage your subscription and billing details."
      >
        {/* Current plan badge */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
              isPro
                ? "bg-primary/10 border-primary/20"
                : "bg-muted border-border"
            )}>
              {isPro ? (
                <Crown size={18} className="text-primary" />
              ) : (
                <Zap size={18} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground capitalize">{plan} Plan</p>
              {isPro && subscription?.currentPeriodEnd ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subscription.status === "cancelled"
                    ? `Access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                    : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-0.5">3 achievements / month</p>
              )}
            </div>
          </div>

          {isPro ? (
            subscription?.status !== "cancelled" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCancel(true)}
                className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                Cancel
              </Button>
            )
          ) : (
            <a
              href="#upgrade"
              onClick={(e) => {
                e.preventDefault();
                // Dispatch a custom event that the layout can listen to
                window.dispatchEvent(new CustomEvent("open-upgrade-modal"));
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/95 transition-colors"
            >
              Upgrade to Pro
              <ChevronRight size={12} />
            </a>
          )}
        </div>

        {/* Free plan feature limits */}
        {!isPro && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary flex items-center gap-2">
              <Crown size={13} />
              Unlock with Pro — ₹499/month
            </p>
            <ul className="space-y-1.5">
              {[
                "Unlimited achievements",
                "Publish directly to LinkedIn",
                "Portfolio auto-deploy",
                "Unlimited resume versions",
                "Unlimited AI career coach",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={11} className="text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Billing cycle detail for Pro */}
        {isPro && subscription && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                <CreditCard size={11} /> Billing cycle
              </p>
              <p className="text-sm font-semibold text-foreground capitalize">
                {subscription.billingCycle}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                <Calendar size={11} /> Status
              </p>
              <p className={cn(
                "text-sm font-semibold capitalize",
                subscription.status === "active" ? "text-primary" : "text-muted-foreground"
              )}>
                {subscription.status}
              </p>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. PREFERENCES
// ---------------------------------------------------------------------------

type ThemeOption = "dark" | "light" | "system";

const THEME_OPTIONS: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { value: "dark", label: "Dark", icon: <Moon size={14} /> },
  { value: "light", label: "Light", icon: <Sun size={14} /> },
  { value: "system", label: "System", icon: <Monitor size={14} /> },
];

function PreferencesSection({
  initialEmailNotifications,
  initialAutoApplyResumeUpdates,
  onFlash,
}: {
  initialEmailNotifications: boolean;
  initialAutoApplyResumeUpdates: boolean;
  onFlash: (text: string, variant: ToastVariant) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [emailNotif, setEmailNotif] = useState(initialEmailNotifications);
  const [autoApplyResume, setAutoApplyResume] = useState(initialAutoApplyResumeUpdates);
  const [isSaving, setIsSaving] = useState(false);

  async function handleEmailNotifToggle() {
    const next = !emailNotif;
    setEmailNotif(next);
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      onFlash(
        next ? "Email notifications enabled" : "Email notifications disabled",
        "default"
      );
    } catch {
      setEmailNotif(!next); // revert
      onFlash("Failed to save preference", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAutoApplyResumeToggle() {
    const next = !autoApplyResume;
    setAutoApplyResume(next);
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApplyResumeUpdates: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      onFlash(
        next ? "Automatic resume updates enabled" : "Automatic resume updates disabled",
        "default"
      );
    } catch {
      setAutoApplyResume(!next); // revert
      onFlash("Failed to save preference", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Section title="Preferences" description="Personalise your Career Autopilot experience.">
      {/* Theme */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Theme</p>
        <div className="inline-flex gap-1 bg-muted rounded-xl p-1 border border-border">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                theme === opt.value
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email notifications */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            {emailNotif ? (
              <Bell size={16} className="text-primary" />
            ) : (
              <BellOff size={16} className="text-muted-foreground/60" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Email notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weekly digest, achievement milestones, billing updates
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={emailNotif}
          onClick={handleEmailNotifToggle}
          disabled={isSaving}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            emailNotif ? "bg-primary" : "bg-border",
            isSaving && "opacity-60 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow transform transition-transform",
              emailNotif ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* Automatically apply resume suggestions */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            {autoApplyResume ? (
              <FileText size={16} className="text-primary" />
            ) : (
              <FileText size={16} className="text-muted-foreground/60" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Automatically apply resume suggestions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instantly regenerate your resume PDF when career achievements are logged
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={autoApplyResume}
          onClick={handleAutoApplyResumeToggle}
          disabled={isSaving}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            autoApplyResume ? "bg-primary" : "bg-border",
            isSaving && "opacity-60 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow transform transition-transform",
              autoApplyResume ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 4. DANGER ZONE
// ---------------------------------------------------------------------------

function DeleteAccountDialog({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [typed, setTyped] = useState("");
  const confirmed = typed === "DELETE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="border border-destructive/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Delete account permanently?</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              All achievements, posts, resumes, and account data will be
              deleted immediately. This action <span className="text-destructive font-semibold">cannot be undone</span>.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Type <span className="text-destructive font-mono">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="w-full bg-muted border border-border focus:border-destructive/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-destructive/20 font-mono"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={!confirmed || isLoading}
            className={cn(
              "flex-1 font-bold",
              confirmed
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-muted text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 size={13} className="mr-1.5 animate-spin" />
            ) : (
              <Trash2 size={13} className="mr-1.5" />
            )}
            Delete everything
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DangerZoneSection({ onFlash }: { onFlash: (text: string, variant: ToastVariant) => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const { signOut } = useClerk();
  const router = useRouter();

  function handleDelete() {
    startDelete(async () => {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (res.ok) {
        await signOut();
        router.push("/");
      } else {
        onFlash("Account deletion failed — please contact support", "error");
        setShowDialog(false);
      }
    });
  }

  return (
    <>
      {showDialog && (
        <DeleteAccountDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDialog(false)}
          isLoading={isDeleting}
        />
      )}

      <Section
        title="Danger Zone"
        description="Irreversible actions — proceed with caution."
        danger
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove your account and all associated data.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowDialog(true)}
            className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 font-semibold gap-2 shrink-0"
          >
            <Trash2 size={13} />
            Delete account
          </Button>
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function SettingsClient({
  linkedinAccount,
  githubConnected,
  subscription,
  plan,
  email: _email,
  initialEmailNotifications,
  initialResumeRules,
  initialAutoApplyResumeUpdates,
  linkedinError,
  linkedinConnected,
}: Props & {
  initialEmailNotifications: boolean;
  initialAutoApplyResumeUpdates: boolean;
}) {
  const { msg, flash } = useFlash();

  // Show OAuth result flash on mount (from URL search params)
  useEffect(() => {
    if (linkedinError) {
      const desc = decodeURIComponent(linkedinError).replace(/_/g, " ");
      flash(`LinkedIn error: ${desc}`, "error");
    } else if (linkedinConnected) {
      flash("LinkedIn connected successfully!", "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <FlashBanner msg={msg} />

      <ConnectedAccountsSection
        linkedinAccount={linkedinAccount}
        githubConnected={githubConnected}
        onFlash={flash}
      />

      <ResumePreferencesSection
        initial={initialResumeRules ?? null}
        onFlash={flash}
      />

      <PlanBillingSection
        plan={plan}
        subscription={subscription}
        onFlash={flash}
      />

      <PreferencesSection
        initialEmailNotifications={initialEmailNotifications}
        initialAutoApplyResumeUpdates={initialAutoApplyResumeUpdates}
        onFlash={flash}
      />

      <DangerZoneSection onFlash={flash} />
    </div>
  );
}
