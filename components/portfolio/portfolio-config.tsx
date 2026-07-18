'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams as useNextSearchParams } from 'next/navigation'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  Github,
  Star,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  Globe,
  ChevronRight,
  RotateCcw,
  Clock,
  Zap,
  X,
  FileText,
  Palette,
  Code2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PortfolioConfig } from '@/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  portfolioConfig: PortfolioConfig | null
  hasGitHub: boolean
  githubToken: string | null
}

interface GithubRepo {
  id: number
  name: string
  full_name: string
  language: string | null
  stargazers_count: number
  pushed_at: string
  html_url: string
  description: string | null
}

interface DetectionResult {
  projectType: string
  deployTarget: string
  buildCommand?: string
  outputDir?: string
  estimatedDeployMinutes: number
}

type WizardStep = 'select' | 'detect' | 'deploy'

// ---------------------------------------------------------------------------
// Language colour map
// ---------------------------------------------------------------------------

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  JavaScript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Python: 'bg-green-500/20 text-green-300 border-green-500/30',
  Rust: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Go: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Ruby: 'bg-red-500/20 text-red-300 border-red-500/30',
  Java: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  'C++': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  C: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'C#': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Svelte: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Vue: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

function LangBadge({ lang }: { lang: string | null }) {
  if (!lang) return null
  const cls = LANG_COLORS[lang] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
        cls
      )}
    >
      {lang}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Platform badge
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  vercel: 'Vercel',
  netlify: 'Netlify',
  'github-pages': 'GitHub Pages',
  render: 'Render',
  railway: 'Railway',
  supabase: 'Supabase Storage',
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
      <Zap size={10} />
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CSS confetti (30 particles, no JS lib)
// ---------------------------------------------------------------------------

function Confetti() {
  const colors = ['#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa']
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => {
        const color = colors[i % colors.length]
        const left = `${Math.random() * 100}%`
        const delay = `${Math.random() * 1.5}s`
        const dur = `${1.5 + Math.random() * 1.5}s`
        const size = `${6 + Math.floor(Math.random() * 8)}px`
        return (
          <span
            key={i}
            style={
              {
                position: 'absolute',
                top: '-20px',
                left,
                width: size,
                height: size,
                background: color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animation: `confettiFall ${dur} ${delay} ease-in forwards`,
                opacity: 0,
                transform: `rotate(${Math.random() * 360}deg)`,
              } as React.CSSProperties
            }
          />
        )
      })}
      <style>{`
        @keyframes confettiFall {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resume Portfolio Generator (STEP 6 — no-GitHub path)
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    id: 'minimal' as const,
    label: 'Minimal',
    desc: 'Clean, light background. Works for everyone.',
    icon: FileText,
    recommended: true,
  },
  {
    id: 'developer' as const,
    label: 'Developer',
    desc: 'Dark theme with terminal feel.',
    icon: Code2,
    recommended: false,
  },
  {
    id: 'creative' as const,
    label: 'Creative',
    desc: 'Gradient accent, more visual flair.',
    icon: Palette,
    recommended: false,
  },
]

function ResumePortfolioGenerator({
  onGenerated,
}: {
  onGenerated: (url: string) => void
}) {
  const [template, setTemplate] = useState<'minimal' | 'developer' | 'creative'>('minimal')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/portfolio/resume-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      onGenerated(data.url!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Choose a template
        </h3>
        <p className="text-xs text-muted-foreground">
          We'll generate a static HTML page from your resume and achievements — no GitHub needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          const selected = template === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={cn(
                'relative flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200',
                selected
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              )}
            >
              {t.recommended && (
                <span className="absolute top-2 right-2 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                  Recommended
                </span>
              )}
              <Icon
                size={20}
                className={selected ? 'text-primary' : 'text-muted-foreground'}
              />
              <div>
                <p className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                  {t.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold gap-2 disabled:opacity-60"
      >
        {isGenerating ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating portfolio…
          </>
        ) : (
          <>
            <Sparkles size={15} />
            Generate my portfolio
            <ArrowRight size={15} />
          </>
        )}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center">
        Generates instantly · Hosted on Supabase · Public URL ready to share
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STATE 1 — No GitHub connected (two-tab layout)
// ---------------------------------------------------------------------------

const GITHUB_SETUP_STEPS = [
  {
    title: 'Go to github.com/signup',
    description: 'Create a free account — only takes 2 minutes.',
  },
  {
    title: 'Verify your email',
    description: "GitHub sends you a confirmation link — check your inbox.",
  },
  {
    title: 'Come back and connect',
    description: 'Return here and click "Connect GitHub" to link your account.',
  },
]

function ConnectGitHub({ onResumeGenerated }: { onResumeGenerated: (url: string) => void }) {
  const [tab, setTab] = useState<'github' | 'resume'>('github')
  const [showGuide, setShowGuide] = useState(false)
  const searchParams = useNextSearchParams()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const connected = searchParams.get('github_connected')
    const error = searchParams.get('github_error')
    if (connected === '1') {
      setToast({ type: 'success', msg: 'GitHub connected successfully! Refreshing…' })
      setTimeout(() => window.location.reload(), 1500)
    } else if (error) {
      const msgs: Record<string, string> = {
        github_denied: 'GitHub connection was cancelled.',
        token_exchange_failed: 'Failed to get GitHub token — please try again.',
        invalid_callback: 'Invalid OAuth callback — please try again.',
        oauth_not_configured: 'GitHub OAuth is not configured. Contact support.',
        server_error: 'Server error during connection. Please try again.',
        db_error: 'Failed to save connection. Please try again.',
      }
      setToast({ type: 'error', msg: msgs[error] ?? 'GitHub connection failed.' })
    }
  }, [searchParams])

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl border text-sm',
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl border border-border">
        <button
          onClick={() => setTab('github')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            tab === 'github'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Github size={15} />
          Connect GitHub
        </button>
        <button
          onClick={() => setTab('resume')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            tab === 'resume'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText size={15} />
          Use resume instead
        </button>
      </div>

      {/* Tab: Connect GitHub */}
      {tab === 'github' && !showGuide && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Connect your GitHub account</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Link GitHub to browse your repositories and deploy your portfolio with one click.
              No manual configuration needed.
            </p>
          </div>

          {/* Direct OAuth button */}
          <a
            href="/api/portfolio/github-auth"
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-colors shadow-lg"
          >
            <Github size={18} />
            Continue with GitHub
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/60">Don't have GitHub?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={() => setShowGuide(true)}
            className="w-full py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 text-sm font-medium transition-colors"
          >
            Create a GitHub account →
          </button>
        </div>
      )}

      {/* Tab: GitHub signup guide */}
      {tab === 'github' && showGuide && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGuide(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Create a GitHub account</h2>
              <p className="text-xs text-muted-foreground">Free and takes 2 minutes</p>
            </div>
          </div>

          <div className="space-y-3">
            {GITHUB_SETUP_STEPS.map((step, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href="https://github.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted font-medium text-sm transition-colors"
          >
            <Github size={16} />
            Create GitHub account →
          </a>

          <button
            onClick={() => setShowGuide(false)}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            I already have GitHub — connect it →
          </button>
        </div>
      )}

      {/* Tab: Resume portfolio */}
      {tab === 'resume' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Portfolio from resume</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              We'll generate a beautiful static portfolio page from your resume and recent achievements.
              No GitHub or build step required.
            </p>
          </div>
          <ResumePortfolioGenerator onGenerated={onResumeGenerated} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WIZARD STEP 1 — Select repo
// ---------------------------------------------------------------------------

function RepoSelector({
  onSelect,
}: {
  onSelect: (repo: GithubRepo) => void;
}) {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadRepos = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/portfolio/repos?page=${p}`);
        const data = (await res.json()) as
          | { repos: GithubRepo[]; hasMore: boolean }
          | { error: string };

        if ("error" in data) {
          setError(data.error);
          return;
        }

        setRepos((prev) => (append ? [...prev, ...data.repos] : data.repos));
        setHasMore(data.hasMore);
      } catch {
        setError("Failed to load repositories");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadRepos(1, false);
  }, [loadRepos]);

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter repositories..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
      </div>

      {/* Repo list */}
      {loading && repos.length === 0 ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-muted border border-border animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void loadRepos(1, false)}
            className="text-muted-foreground"
          >
            <RefreshCw size={13} className="mr-1.5" />
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No repositories match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onSelect(repo)}
              className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-muted-foreground/30 hover:bg-muted transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {repo.name}
                    </span>
                    <LangBadge lang={repo.language} />
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {repo.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-xs">
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Star size={11} />
                      {repo.stargazers_count}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {formatDistanceToNow(parseISO(repo.pushed_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <ChevronRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400"
                  />
                </div>
              </div>
            </button>
          ))}

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground mt-2"
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                void loadRepos(nextPage, true);
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={13} className="mr-1.5 animate-spin" />
              ) : null}
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WIZARD STEP 2 — Detect
// ---------------------------------------------------------------------------

function DetectStep({
  repo,
  onConfirm,
  onBack,
}: {
  repo: GithubRepo;
  onConfirm: (detection: DetectionResult) => void;
  onBack: () => void;
}) {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    async function detect() {
      setLoading(true);
      setError(null);
      try {
        const [owner, name] = repo.full_name.split("/");
        const res = await fetch("/api/portfolio/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoOwner: owner, repoName: name }),
        });
        const data = (await res.json()) as
          | DetectionResult
          | { error: string };

        if ("error" in data) {
          setError(data.error);
          return;
        }
        setDetection(data);
      } catch {
        setError("Detection failed — please try again");
      } finally {
        setLoading(false);
      }
    }
    void detect();
  }, [repo]);

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={15} />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Reviewing {repo.name}</h2>
          <p className="text-xs text-muted-foreground">
            Detecting project type…
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 size={32} className="text-emerald-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Analysing repository structure…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onBack}
          >
            Go back
          </Button>
        </div>
      ) : detection ? (
        <div className="flex flex-col gap-4">
          {/* Detection result card */}
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Project type
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {detection.projectType}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Deploy to
              </span>
              <PlatformBadge platform={detection.deployTarget} />
            </div>

            {detection.buildCommand && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  Build command
                </span>
                <code className="text-xs text-foreground bg-muted px-2 py-1 rounded font-mono border border-border">
                  {detection.buildCommand}
                </code>
              </div>
            )}

            {detection.outputDir && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Output dir
                </span>
                <code className="text-xs text-foreground bg-muted px-2 py-1 rounded font-mono border border-border">
                  {detection.outputDir}
                </code>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Est. deploy time
              </span>
              <span className="text-xs text-muted-foreground">
                ~{detection.estimatedDeployMinutes} min
              </span>
            </div>
          </div>

          {/* Warning for unknown type */}
          {detection.projectType === "unknown" && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <AlertTriangle
                size={16}
                className="text-yellow-400 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-0.5">
                  Unknown project type
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We couldn&apos;t detect a known framework. Deployment will attempt
                  a static file deploy — it may not work as expected.
                </p>
              </div>
            </div>
          )}

          {/* Confirm */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-4 h-4 rounded border border-border peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors" />
              <CheckCircle2
                size={10}
                className={cn(
                  "absolute inset-0 m-auto text-zinc-950 transition-opacity",
                  confirmed ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I understand this will deploy{" "}
              <span className="text-foreground font-medium">{repo.full_name}</span>{" "}
              to{" "}
              <span className="text-foreground font-medium">
                {PLATFORM_LABELS[detection.deployTarget] ?? detection.deployTarget}
              </span>{" "}
              and make it publicly accessible.
            </p>
          </label>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground"
            >
              Back
            </Button>
            <Button
              size="sm"
              disabled={!confirmed}
              onClick={() => onConfirm(detection)}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
            >
              Deploy →
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WIZARD STEP 3 — Deploying
// ---------------------------------------------------------------------------

function DeployStep({
  repo,
  detection,
  onSuccess,
  onError,
}: {
  repo: GithubRepo;
  detection: DetectionResult;
  onSuccess: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<"enqueueing" | "polling" | "done" | "failed">(
    "enqueueing"
  );
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function startDeploy() {
      const [owner, name] = repo.full_name.split("/");
      try {
        const res = await fetch("/api/portfolio/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoOwner: owner,
            repoName: name,
            confirmed: true,
          }),
        });

        const data = (await res.json()) as
          | { status: string; platform?: string; message?: string }
          | { error: string };

        if ("error" in data) {
          setStatus("failed");
          setDeployError(data.error);
          onError(data.error);
          return;
        }

        // API returned 'deploying' — QStash job enqueued, start polling DB
        setStatus("polling");

        let attempts = 0;
        const maxAttempts = 36; // 36 × 5s = 3 minutes
        pollRef.current = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollRef.current!);
            const msg = "Deployment timed out after 3 minutes. Please try again.";
            setStatus("failed");
            setDeployError(msg);
            onError(msg);
            return;
          }

          try {
            const pollRes = await fetch("/api/portfolio/deploy/status");
            const pollData = (await pollRes.json()) as
              | { status: string; deployUrl?: string | null; deployError?: string | null }
              | { error: string };

            if ("error" in pollData) return; // transient — keep polling

            if (pollData.status === "live") {
              clearInterval(pollRef.current!);
              const url = pollData.deployUrl ?? null;
              if (url) setDeployUrl(url);
              setStatus("done");
              onSuccess(url ?? "");
            } else if (pollData.status === "failed") {
              clearInterval(pollRef.current!);
              const errMsg = pollData.deployError ?? "Deployment failed on the platform.";
              setStatus("failed");
              setDeployError(errMsg);
              onError(errMsg);
            }
            // 'deploying' → keep polling
          } catch {
            // transient network error — keep polling
          }
        }, 5000);
      } catch {
        const msg = "Network error starting deployment.";
        setStatus("failed");
        setDeployError(msg);
        onError(msg);
      }
    }

    void startDeploy();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [repo, detection, onSuccess, onError]);

  const platform = PLATFORM_LABELS[detection.deployTarget] ?? detection.deployTarget;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 p-6 text-center">
      {(status === "enqueueing" || status === "polling") && (
        <>
          {/* Animated deploy indicator */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-emerald-500/40 animate-ping [animation-delay:0.3s]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe size={28} className="text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-foreground mb-1">
              {status === "enqueueing" ? "Starting deployment…" : `Deploying to ${platform}…`}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === "polling"
                ? `This takes ~${detection.estimatedDeployMinutes} min. Running in the background.`
                : "Setting up your deployment…"}
            </p>
          </div>
          {/* Indeterminate progress bar */}
          <div className="w-56 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-[shimmer_1.5s_infinite] w-1/2" />
          </div>
          {deployUrl && (
            <p className="text-xs text-muted-foreground font-mono break-all max-w-sm">
              {deployUrl}
            </p>
          )}
        </>
      )}

      {status === "done" && deployUrl && (
        <>
          <CheckCircle2 size={52} className="text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-foreground mb-1">
              Portfolio is live! 🎉
            </p>
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              {deployUrl}
            </a>
          </div>
        </>
      )}

      {status === "failed" && (
        <div className="flex flex-col items-center gap-3 max-w-sm">
          <AlertTriangle size={40} className="text-red-400" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Deployment failed</p>
            {deployError && (
              <p className="text-xs text-muted-foreground">{deployError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WIZARD wrapper (steps 1-3)
// ---------------------------------------------------------------------------

function RepoWizard({ onComplete }: { onComplete: (url: string) => void }) {
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const STEP_LABELS: Record<WizardStep, string> = {
    select: "Select repo",
    detect: "Review",
    deploy: "Deploy",
  };
  const STEPS: WizardStep[] = ["select", "detect", "deploy"];
  const stepIdx = STEPS.indexOf(step);

  function handleSuccess(url: string) {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    onComplete(url);
  }

  return (
    <div className="flex-1">
      {showConfetti && <Confetti />}

      {/* Step indicator */}
      <div className="border-b border-border px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors",
                  idx < stepIdx
                    ? "bg-primary border-primary text-primary-foreground"
                    : idx === stepIdx
                    ? "bg-muted border-border text-foreground"
                    : "bg-transparent border-border text-muted-foreground/50"
                )}
              >
                {idx < stepIdx ? (
                  <CheckCircle2 size={12} />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline transition-colors",
                  idx === stepIdx ? "text-foreground font-medium" : "text-muted-foreground/50"
                )}
              >
                {STEP_LABELS[s]}
              </span>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-8 transition-colors",
                    idx < stepIdx ? "bg-primary/40" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === "select" && (
        <RepoSelector
          onSelect={(repo) => {
            setSelectedRepo(repo);
            setStep("detect");
          }}
        />
      )}

      {step === "detect" && selectedRepo && (
        <DetectStep
          repo={selectedRepo}
          onConfirm={(d) => {
            setDetection(d);
            setStep("deploy");
          }}
          onBack={() => setStep("select")}
        />
      )}

      {step === "deploy" && selectedRepo && detection && (
        <>
          {deployError ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <AlertTriangle size={40} className="text-red-400" />
              <p className="text-sm text-red-400">{deployError}</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  setDeployError(null);
                  setStep("detect");
                }}
              >
                <RotateCcw size={13} className="mr-1.5" />
                Try again
              </Button>
            </div>
          ) : (
            <DeployStep
              repo={selectedRepo}
              detection={detection}
              onSuccess={handleSuccess}
              onError={(msg) => setDeployError(msg)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATE 3 — Configured view
// ---------------------------------------------------------------------------

function ConfiguredView({
  config,
  onRedeploy,
  onChangeRepo,
}: {
  config: PortfolioConfig;
  onRedeploy: () => void;
  onChangeRepo: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Live URL card */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Live
          </span>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1 truncate">
          {config.deployUrl}
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Your portfolio is publicly accessible
        </p>
        <div className="flex gap-3">
          <a
            href={config.deployUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors"
          >
            <Globe size={14} />
            Visit site
            <ExternalLink size={12} />
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedeploy}
            className="border-border text-foreground hover:bg-muted gap-2"
          >
            <RefreshCw size={13} />
            Update deployment
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border">
        {config.deployPlatform && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Platform</span>
            <PlatformBadge platform={config.deployPlatform} />
          </div>
        )}

        {config.projectType && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Project type</span>
            <span className="text-xs font-medium text-foreground px-2 py-0.5 rounded bg-card border border-border">
              {config.projectType}
            </span>
          </div>
        )}

        {/* Repository row with Change repo button */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs text-muted-foreground">Repository</div>
            {config.githubRepoUrl ? (
              <a
                href={config.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <Github size={12} />
                {config.githubRepoUrl.replace("https://github.com/", "")}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground/50 mt-0.5">Not set</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onChangeRepo}
            className="border-border text-foreground hover:bg-muted gap-1.5 shrink-0"
          >
            <RotateCcw size={12} />
            Change repo
          </Button>
        </div>

        {config.lastDeployed && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Last deployed</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(config.lastDeployed), {
                addSuffix: true,
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change-repo sub-wizard (reuses existing steps inside a panel overlay)
// ---------------------------------------------------------------------------

type ChangeRepoStep = 'select' | 'detect' | 'deploy'

function ChangeRepoWizard({
  onComplete,
  onCancel,
}: {
  onComplete: (url: string) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<ChangeRepoStep>('select')
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  function handleSuccess(url: string) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 4000)
    onComplete(url)
  }

  const STEP_LABELS: Record<ChangeRepoStep, string> = {
    select: 'Select repo',
    detect: 'Review',
    deploy: 'Deploy',
  }
  const STEPS: ChangeRepoStep[] = ['select', 'detect', 'deploy']
  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 z-40 bg-background/90 backdrop-blur-sm flex flex-col">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <span className="text-sm font-semibold text-foreground">Change repository</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors',
                  idx < stepIdx
                    ? 'bg-primary border-primary text-primary-foreground'
                    : idx === stepIdx
                    ? 'bg-muted border-border text-foreground'
                    : 'bg-transparent border-border text-muted-foreground/50'
                )}
              >
                {idx < stepIdx ? <CheckCircle2 size={10} /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs hidden sm:inline transition-colors',
                  idx === stepIdx ? 'text-foreground font-medium' : 'text-muted-foreground/50'
                )}
              >
                {STEP_LABELS[s]}
              </span>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px w-6 transition-colors',
                    idx < stepIdx ? 'bg-primary/40' : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'select' && (
          <RepoSelector
            onSelect={(repo) => {
              setSelectedRepo(repo)
              setStep('detect')
            }}
          />
        )}

        {step === 'detect' && selectedRepo && (
          <DetectStep
            repo={selectedRepo}
            onConfirm={(d) => {
              setDetection(d)
              setStep('deploy')
            }}
            onBack={() => setStep('select')}
          />
        )}

        {step === 'deploy' && selectedRepo && detection && (
          <>
            {deployError ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <AlertTriangle size={40} className="text-red-400" />
                <p className="text-sm text-red-400">{deployError}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    setDeployError(null)
                    setStep('detect')
                  }}
                >
                  <RotateCcw size={13} className="mr-1.5" />
                  Try again
                </Button>
              </div>
            ) : (
              <DeployStep
                repo={selectedRepo}
                detection={detection}
                onSuccess={handleSuccess}
                onError={(msg) => setDeployError(msg)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function PortfolioConfig({
  portfolioConfig: initialConfig,
  hasGitHub,
}: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [showWizard, setShowWizard] = useState(false)
  const [showRepoSelector, setShowRepoSelector] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  function handleDeployComplete(url: string) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 4000)
    setConfig((prev) =>
      prev
        ? { ...prev, deployUrl: url }
        : ({
            id: '',
            userId: '',
            deployUrl: url,
            githubRepoUrl: null,
            githubRepoId: null,
            deployPlatform: null,
            projectType: null,
            template: 'minimal',
            platformProjectId: null,
            lastDeployed: null,
          } as PortfolioConfig)
    )
    setShowWizard(false)
  }

  function handleChangeRepoComplete(url: string) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 4000)
    // Refresh the page so the updated portfolio_config is fetched from the DB
    setShowRepoSelector(false)
    window.location.reload()
  }

  // Case 1: No GitHub connected — show two-tab UI
  if (!hasGitHub) {
    return (
      <>
        {showConfetti && <Confetti />}
        <ConnectGitHub onResumeGenerated={handleDeployComplete} />
      </>
    )
  }

  // Case 2a: Configured and not re-deploying
  if (config?.deployUrl && !showWizard) {
    return (
      <>
        {showConfetti && <Confetti />}
        <ConfiguredView
          config={config}
          onRedeploy={() => setShowWizard(true)}
          onChangeRepo={() => setShowRepoSelector(true)}
        />
        {showRepoSelector && (
          <ChangeRepoWizard
            onComplete={handleChangeRepoComplete}
            onCancel={() => setShowRepoSelector(false)}
          />
        )}
      </>
    )
  }

  // Case 2b: Wizard (no config yet, or re-deploying)
  return (
    <RepoWizard
      onComplete={handleDeployComplete}
    />
  )
}
