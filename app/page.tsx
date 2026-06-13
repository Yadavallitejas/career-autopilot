"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import {
  Rocket,
  Brain,
  Linkedin,
  FileText,
  Globe,
  Menu,
  X,
  Check,
  ChevronRight,
  Zap,
  ArrowRight,
} from "lucide-react";
import PricingCards from "@/components/landing/pricing-cards";
import FaqAccordion from "@/components/landing/faq-accordion";

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="text-emerald-400 group-hover:text-emerald-300 transition-colors">
            <Rocket size={20} strokeWidth={2.5} />
          </span>
          <span className="font-bold text-white tracking-tight text-lg">
            Career Autopilot
          </span>
        </Link>

        {/* Center nav — desktop */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right — desktop */}
        <div className="hidden md:flex items-center gap-4">
          <SignedOut>
            <Link
              href="/sign-in"
              className="text-sm text-zinc-400 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/20"
            >
              Get Started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Dashboard
            </Link>
            <div className="h-8 w-8 flex items-center justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>

        {/* Hamburger — mobile */}
        <button
          className="md:hidden text-zinc-400 hover:text-white p-1"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 py-4 flex flex-col gap-3">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-zinc-300 hover:text-white py-2 text-sm font-medium"
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-center text-sm text-zinc-400 hover:text-white py-2 rounded-lg border border-zinc-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-center text-sm font-semibold bg-emerald-500 text-zinc-950 py-2.5 rounded-lg"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="text-center text-sm text-zinc-400 hover:text-white py-2 rounded-lg border border-zinc-800 transition-colors"
              >
                Dashboard
              </Link>
              <div className="flex justify-center py-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO SECTION
───────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Background radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(52,211,153,0.08) 0%, transparent 70%)",
        }}
      />
      {/* Grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center flex flex-col items-center gap-6">
        {/* Beta badge */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Now in public beta
        </div>

        {/* H1 */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white text-balance leading-[1.08]"
          style={{ animationDelay: "0.1s" }}
        >
          Your career,{" "}
          <span className="text-emerald-400">on autopilot.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl text-balance leading-relaxed">
          Log one achievement. We update your LinkedIn, resume, and
          portfolio&nbsp;— <span className="text-zinc-200">automatically.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <SignedOut>
            <Link
              href="/sign-up"
              className="group flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-7 py-3.5 rounded-xl text-base transition-all duration-200 shadow-xl shadow-emerald-500/25"
            >
              Start for free
              <ArrowRight
                size={16}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-7 py-3.5 rounded-xl text-base transition-all duration-200 shadow-xl shadow-emerald-500/25"
            >
              Go to Dashboard
              <ArrowRight
                size={16}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </SignedIn>
          <a
            href="#features"
            className="flex items-center gap-2 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 px-7 py-3.5 rounded-xl text-base font-semibold transition-all duration-200"
          >
            See how it works
          </a>
        </div>

        {/* Social proof */}
        <p className="text-sm text-zinc-500 mt-1">
          Joined by{" "}
          <span className="text-zinc-300 font-medium">500+ professionals</span>{" "}
          from Infosys, TCS, Wipro&nbsp;and more...
        </p>

        {/* Terminal demo */}
        <div className="w-full max-w-2xl mt-8 animate-glow">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Terminal titlebar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs font-mono text-zinc-500">
                career-autopilot — terminal
              </span>
            </div>

            {/* Terminal body */}
            <div className="p-5 font-mono text-sm">
              <div className="flex items-start gap-2 text-zinc-400">
                <span className="text-emerald-400 shrink-0 mt-px">❯</span>
                <span className="animate-typing text-zinc-200">
                  Completed AWS Solutions Architect certification...
                </span>
              </div>

              {/* Result cards */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="animate-slide-up-1 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 flex items-center gap-2.5">
                  <span className="text-emerald-400 bg-emerald-400/10 p-1.5 rounded-lg">
                    <Linkedin size={14} />
                  </span>
                  <div>
                    <p className="text-xs text-zinc-200 font-semibold">
                      LinkedIn post drafted
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Ready to publish
                    </p>
                  </div>
                </div>
                <div className="animate-slide-up-2 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 flex items-center gap-2.5">
                  <span className="text-emerald-400 bg-emerald-400/10 p-1.5 rounded-lg">
                    <FileText size={14} />
                  </span>
                  <div>
                    <p className="text-xs text-zinc-200 font-semibold">
                      Resume updated
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Bullet added ✓
                    </p>
                  </div>
                </div>
                <div className="animate-slide-up-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 flex items-center gap-2.5">
                  <span className="text-emerald-400 bg-emerald-400/10 p-1.5 rounded-lg">
                    <Globe size={14} />
                  </span>
                  <div>
                    <p className="text-xs text-zinc-200 font-semibold">
                      Portfolio live
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Deployed in 2s
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PROBLEM VS SOLUTION
───────────────────────────────────────────── */
function ProblemSection() {
  const oldWaySteps = [
    { task: "Write LinkedIn post", time: "20 min" },
    { task: "Write X post", time: "10 min" },
    { task: "Update resume", time: "15 min" },
    { task: "Update portfolio", time: "30 min" },
    { task: "Repeat for every achievement", time: "30 min" },
  ];

  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Stop losing time to manual updates
          </h2>
          <p className="text-zinc-400 mt-3 text-lg">
            Every achievement you ship deserves to be seen — not buried in a
            to-do list.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Old way */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-red-400 text-lg">✗</span>
              <h3 className="text-lg font-bold text-red-400">The old way</h3>
            </div>
            <ol className="space-y-4">
              {oldWaySteps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-xs font-mono text-red-500/70 bg-red-500/10 px-2 py-0.5 rounded mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-zinc-300 text-sm">{step.task}</span>
                    <span className="text-red-400/80 text-xs font-mono shrink-0">
                      {step.time}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 pt-5 border-t border-red-500/20">
              <p className="text-sm text-red-300 font-semibold">
                ~105 minutes. Per achievement.
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Most people do none of it.
              </p>
            </div>
          </div>

          {/* With Career Autopilot */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-emerald-400 text-lg">✓</span>
                <h3 className="text-lg font-bold text-emerald-400">
                  With Career Autopilot
                </h3>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-8">
                Log it once. Done. All five — automated.
              </p>

              {/* Input mockup */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">
                    <ChevronRight size={14} />
                  </span>
                  <span className="text-sm text-zinc-400 font-mono">
                    Got AWS certified today 🎉
                  </span>
                </div>
              </div>

              {/* 5 outputs */}
              <div className="space-y-2.5">
                {[
                  "LinkedIn post drafted",
                  "X post generated",
                  "Resume bullet added",
                  "Portfolio updated",
                  "Achievement scored & logged",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check size={11} className="text-emerald-400" />
                    </span>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-emerald-500/20">
              <p className="text-sm text-emerald-300 font-semibold">
                ~30 seconds. Every achievement.
              </p>
              <p className="text-xs text-zinc-500 mt-1">Every time.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES SECTION
───────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI Achievement Intelligence",
      description:
        "Scores every milestone for resume vs portfolio fit. Knows which wins belong on LinkedIn vs your CV.",
      accent: "emerald",
    },
    {
      icon: Linkedin,
      title: "LinkedIn Auto-Post",
      description:
        "Hook, insight, hashtags — all drafted in seconds. Sounds like you, not a bot. One click to publish.",
      accent: "blue",
    },
    {
      icon: FileText,
      title: "Resume Auto-Update",
      description:
        "New bullet added to the right section automatically. Impact metrics extracted and formatted to ATS standards.",
      accent: "violet",
    },
    {
      icon: Globe,
      title: "Portfolio Deployment",
      description:
        "Any GitHub repo, live on the web in one click. Auto-generated project pages with descriptions and tech stacks.",
      accent: "amber",
    },
  ];

  const accentMap: Record<string, string> = {
    emerald:
      "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 group-hover:border-emerald-400/40",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20 group-hover:border-blue-400/40",
    violet:
      "text-violet-400 bg-violet-400/10 border-violet-400/20 group-hover:border-violet-400/40",
    amber:
      "text-amber-400 bg-amber-400/10 border-amber-400/20 group-hover:border-amber-400/40",
  };

  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3">
            Everything your career needs, automated
          </h2>
          <p className="text-zinc-400 mt-3 text-lg max-w-xl mx-auto text-balance">
            Four powerful tools working together so you can focus on growing,
            not updating.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            const accent = accentMap[f.accent];
            return (
              <div
                key={f.title}
                className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-5 transition-all duration-300 ${accent}`}
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────── */
function HowItWorksSection() {
  return (
    <section className="py-24 px-4 bg-zinc-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3">
            Three steps. Seriously, just three.
          </h2>
        </div>

        <div className="space-y-16">
          {/* Step 1 */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-7xl font-black text-zinc-800 leading-none mb-4 font-mono">
                01
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Log your achievement
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                Open the app, type what you shipped, learned, or built. Can be
                one sentence — our AI handles the rest. No formatting required.
              </p>
            </div>
            {/* Mockup: textarea UI */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="mb-3">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  What did you accomplish?
                </label>
              </div>
              <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 min-h-[100px] relative">
                <p className="text-sm text-zinc-300 font-mono leading-relaxed">
                  Passed AWS Solutions Architect exam. Score: 892/1000. Studied
                  for 3 weeks using...
                  <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-zinc-600 font-mono">
                  92 characters
                </span>
                <button className="text-xs bg-emerald-500 text-zinc-950 font-bold px-4 py-1.5 rounded-lg">
                  Log Achievement →
                </button>
              </div>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-12 bg-gradient-to-b from-zinc-700 to-transparent" />
          </div>

          {/* Step 2 */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1">
              {/* Mockup: progress bar */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-zinc-400">
                    AI Processing
                  </span>
                  <span className="text-xs text-emerald-400 font-mono">87%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-progress"
                    style={{ width: "87%" }}
                  />
                </div>

                {[
                  { label: "Classifying achievement type", done: true },
                  { label: "Extracting impact metrics", done: true },
                  { label: "Drafting LinkedIn post", done: true },
                  { label: "Generating resume bullet", done: false, active: true },
                  { label: "Updating portfolio page", done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] ${
                        item.done
                          ? "bg-emerald-500/20 text-emerald-400"
                          : item.active
                          ? "bg-zinc-700 border border-emerald-500 animate-pulse"
                          : "bg-zinc-800"
                      }`}
                    >
                      {item.done && <Check size={9} />}
                    </div>
                    <span
                      className={`text-xs ${
                        item.done
                          ? "text-zinc-400 line-through decoration-zinc-600"
                          : item.active
                          ? "text-white"
                          : "text-zinc-600"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="text-7xl font-black text-zinc-800 leading-none mb-4 font-mono">
                02
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                AI classifies and drafts
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                Our model scores the achievement, extracts metrics, and
                generates a LinkedIn post, resume bullet, and portfolio update —
                all in under 10 seconds.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-12 bg-gradient-to-b from-zinc-700 to-transparent" />
          </div>

          {/* Step 3 */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-7xl font-black text-zinc-800 leading-none mb-4 font-mono">
                03
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Review and publish
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                See the draft. Edit if you want. Hit publish. Your LinkedIn
                post, resume, and portfolio update go live — all at once.
              </p>
            </div>
            {/* Mockup: LinkedIn card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-zinc-950 font-bold text-sm shrink-0">
                  A
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Arjun Sharma
                  </p>
                  <p className="text-xs text-zinc-500">
                    Software Engineer · 1st
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs text-blue-400 font-semibold bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded-md">
                    in
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                🏆 Just passed my AWS Solutions Architect exam with 892/1000!
                After 3 weeks of deep study, it feels incredible to validate
                cloud architecture skills I use every day...
              </p>
              <div className="flex gap-2">
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-mono">
                  #AWS
                </span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-mono">
                  #CloudComputing
                </span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-mono">
                  #Career
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition-colors">
                  Post to LinkedIn
                </button>
                <button className="text-xs border border-zinc-700 text-zinc-400 px-3 py-2 rounded-lg hover:border-zinc-500 transition-colors">
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen font-sans">
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />

        {/* PRICING */}
        <section id="pricing" className="py-4 scroll-mt-16">
          <PricingCards />
        </section>

        {/* FAQ */}
        <section id="faq" className="py-4 scroll-mt-16">
          <FaqAccordion />
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Left: logo + copyright */}
            <div className="flex items-center gap-2">
              <Rocket size={16} className="text-emerald-400" />
              <span className="text-sm text-zinc-400">
                <span className="text-white font-semibold">Career Autopilot</span>{" "}
                &copy; 2026
              </span>
            </div>

            {/* Center: tagline */}
            <p className="text-xs text-zinc-600 font-mono hidden sm:block">
              Posted via Career Autopilot
            </p>

            {/* Right: links */}
            <div className="flex items-center gap-5">
              <Link
                href="/#"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/#"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/#"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
