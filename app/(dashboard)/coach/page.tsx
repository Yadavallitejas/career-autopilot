import { requireUser } from '@/lib/get-user'
import { CoachChat } from '@/components/coach/coach-chat'
import Link from 'next/link'
import {
  Lock,
  Bot,
  FileText,
  Linkedin,
  Map,
  Mic,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

export const metadata = {
  title: 'Career Coach — Career Autopilot',
  description:
    'Your AI career coach knows your resume and achievements. Get personalised advice on LinkedIn, interviews, skill gaps, and career progression.',
}

// ---------------------------------------------------------------------------
// Free plan locked state
// ---------------------------------------------------------------------------

const PRO_FEATURES = [
  {
    icon: FileText,
    label: 'Resume feedback',
    desc: 'Get line-by-line suggestions based on your actual resume',
  },
  {
    icon: Linkedin,
    label: 'LinkedIn optimisation',
    desc: 'Know exactly what to improve and what to post next',
  },
  {
    icon: Map,
    label: 'Career roadmap',
    desc: 'A personalised 6-month plan for your next role or promotion',
  },
  {
    icon: Mic,
    label: 'Interview prep',
    desc: 'Stories from your achievements, crafted for STAR-format answers',
  },
]

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-16 text-center">
      {/* Icon stack */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Bot size={42} className="text-muted-foreground" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center shadow-xl">
          <Lock size={16} className="text-muted-foreground" />
        </div>
      </div>

      {/* Heading */}
      <div className="max-w-md space-y-3 mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Career Coach is a Pro feature
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Your AI coach knows your resume, achievements, and career goals —
          and gives you personalised, actionable advice every time.
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full mb-10">
        {PRO_FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-emerald-500 dark:text-emerald-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/settings?tab=billing"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-base transition-all duration-200 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
        >
          <Sparkles size={16} />
          Upgrade to Pro
          <ArrowRight size={16} />
        </Link>
        <p className="text-xs text-muted-foreground">
          ₹499/month · Cancel anytime · Unlimited coach sessions
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pro — full chat page (layout fills the viewport)
// ---------------------------------------------------------------------------

function ProHeader({ userName }: { userName?: string }) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      {/* Coach avatar */}
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <Bot size={16} className="text-emerald-500 dark:text-emerald-400" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-none">
          Career Coach
        </p>
        <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block animate-pulse" />
          Online · knows your achievements
        </p>
      </div>

      {/* Pro badge */}
      <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400">Pro</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CoachPage() {
  const user = await requireUser()

  const isPro = user.plan === 'pro' || user.plan === 'team'

  // Extract name from voiceProfile if available
  const vp = user.voiceProfile as { fullName?: string } | null
  const userName = vp?.fullName ?? undefined

  if (!isPro) {
    return <LockedState />
  }

  return (
    // Height: full viewport minus the dashboard header (h-16 = 64px)
    // On mobile the bottom tab bar adds pb-16 via layout.tsx, which is already handled
    <div className="flex flex-col h-full">
      <ProHeader userName={userName} />
      <div className="flex-1 min-h-0">
        <CoachChat userEmail={user.email} userName={userName} />
      </div>
    </div>
  )
}
