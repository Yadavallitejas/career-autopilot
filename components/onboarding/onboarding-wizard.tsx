"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  CheckCircle2,
  Upload,
  FileText,
  Github,
  Briefcase,
  TrendingUp,
  Target,
  Globe,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  ArrowRight,
  Star,
  Check,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Motivation = "job_hunting" | "brand_building" | "track_achievements" | "portfolio";

interface VoiceProfile {
  fullName: string;
  jobTitle: string;
  industry: string;
  motivation: Motivation | null;
}

interface ResumeRules {
  maxPages: 1 | 2 | null;
  focus: "technical" | "creative" | "balanced";
  excludeSections: string[];
  customInstruction: string;
}

interface UploadedResume {
  versionId: string;
  rawTextPreview: string;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                done
                  ? "bg-emerald-500 text-zinc-950"
                  : active
                  ? "bg-zinc-800 border-2 border-emerald-500 text-emerald-400"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-600"
              )}
            >
              {done ? <Check size={14} /> : n}
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 rounded transition-all duration-500",
                  done ? "bg-emerald-500" : "bg-zinc-800"
                )}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-xs text-zinc-500 font-medium">
        Step {current} of {total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Profile
// ---------------------------------------------------------------------------

const motivationCards: { id: Motivation; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "job_hunting", label: "Job hunting", desc: "Land my next role faster", icon: Target },
  { id: "brand_building", label: "Building my brand", desc: "Grow my LinkedIn presence", icon: TrendingUp },
  { id: "track_achievements", label: "Track achievements", desc: "Never forget what I built", icon: Star },
  { id: "portfolio", label: "Portfolio deployment", desc: "Showcase my projects live", icon: Globe },
];

function Step1Profile({
  profile,
  onChange,
}: {
  profile: VoiceProfile;
  onChange: (p: VoiceProfile) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Welcome! Tell us about yourself
        </h2>
        <p className="text-zinc-400 mt-2 text-base">
          We'll personalise your experience and AI suggestions from the start.
        </p>
      </div>

      {/* Name + Role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Full name
          </label>
          <input
            type="text"
            placeholder="Arjun Sharma"
            value={profile.fullName}
            onChange={(e) => onChange({ ...profile, fullName: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Job title / current role
          </label>
          <input
            type="text"
            placeholder="Software Engineer"
            value={profile.jobTitle}
            onChange={(e) => onChange({ ...profile, jobTitle: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Industry */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Industry
        </label>
        <input
          type="text"
          placeholder="e.g. Software, Finance, Marketing, Healthcare…"
          value={profile.industry}
          onChange={(e) => onChange({ ...profile, industry: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Motivation cards */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          What brings you here?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {motivationCards.map((m) => {
            const Icon = m.icon;
            const selected = profile.motivation === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChange({ ...profile, motivation: m.id })}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 group",
                  selected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/60"
                )}
              >
                <span
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    selected
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  <Icon size={18} />
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", selected ? "text-emerald-400" : "text-zinc-200")}>
                    {m.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{m.desc}</p>
                </div>
                {selected && (
                  <CheckCircle2 size={18} className="text-emerald-400 ml-auto shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Resume Setup
// ---------------------------------------------------------------------------

type ResumeMode = "upload" | "scratch" | "skip" | null;

interface ScratchData {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  currentRole: string;
  currentCompany: string;
  university: string;
  degree: string;
  gradYear: string;
  skills: string[];
  skillInput: string;
  certifications: string;
}

function ResumeRulesAccordion({
  rules,
  onChange,
}: {
  rules: ResumeRules;
  onChange: (r: ResumeRules) => void;
}) {
  const [open, setOpen] = useState(false);

  const FOCUS_OPTIONS: { value: ResumeRules["focus"]; label: string }[] = [
    { value: "technical", label: "Technical / ATS" },
    { value: "creative", label: "Creative / Human" },
    { value: "balanced", label: "Balanced" },
  ];

  const SECTIONS = ["Skills", "Projects", "Certifications", "Summary"];

  function toggleSection(s: string) {
    const next = rules.excludeSections.includes(s)
      ? rules.excludeSections.filter((x) => x !== s)
      : [...rules.excludeSections, s];
    onChange({ ...rules, excludeSections: next });
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors text-left"
      >
        <span className="text-sm font-medium text-zinc-300">
          ✦ Customise resume preferences{" "}
          <span className="text-xs text-zinc-600 font-normal">(optional)</span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-zinc-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="px-4 py-5 space-y-5 bg-zinc-950/40 border-t border-zinc-800">
          {/* Max pages */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Resume length
            </label>
            <div className="flex gap-2">
              {([1, 2, null] as const).map((p) => (
                <button
                  key={String(p)}
                  onClick={() => onChange({ ...rules, maxPages: p })}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    rules.maxPages === p
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {p === null ? "No preference" : `${p} page`}
                </button>
              ))}
            </div>
          </div>

          {/* Focus */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Writing focus
            </label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onChange({ ...rules, focus: f.value })}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    rules.focus === f.value
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exclude sections */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Exclude sections
            </label>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => {
                const excluded = rules.excludeSections.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSection(s)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      excluded
                        ? "border-red-500/50 bg-red-500/10 text-red-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    )}
                  >
                    {excluded && <X size={10} />}
                    {s}
                  </button>
                );
              })}
            </div>
            {rules.excludeSections.length > 0 && (
              <p className="text-xs text-zinc-600">
                These sections won't be included in AI-generated resume bullets.
              </p>
            )}
          </div>

          {/* Custom instruction */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Special instruction
            </label>
            <textarea
              rows={2}
              placeholder={`e.g. "Always include my GitHub link", "Don't include GPA"`}
              value={rules.customInstruction}
              onChange={(e) => onChange({ ...rules, customInstruction: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Step2Resume({
  rules,
  onRulesChange,
  onUploadSuccess,
  onSkip,
  onScratchComplete,
}: {
  rules: ResumeRules;
  onRulesChange: (r: ResumeRules) => void;
  onUploadSuccess: (r: UploadedResume) => void;
  onSkip: () => void;
  onScratchComplete: () => void;
}) {
  const [mode, setMode] = useState<ResumeMode>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedResume | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scratch form state
  const [scratch, setScratch] = useState<ScratchData>({
    name: "", email: "", phone: "", location: "", linkedin: "", github: "",
    currentRole: "", currentCompany: "", university: "", degree: "", gradYear: "",
    skills: [], skillInput: "", certifications: "",
  });
  const [scratchStep, setScratchStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleFile(file: File) {
    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed — please try again.");
        return;
      }
      const result = { versionId: data.versionId, rawTextPreview: data.rawTextPreview ?? "" };
      setUploaded(result);
      onUploadSuccess(result);
    } catch {
      setUploadError("Network error — please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function addSkill() {
    const s = scratch.skillInput.trim();
    if (s && !scratch.skills.includes(s)) {
      setScratch((p) => ({ ...p, skills: [...p.skills, s], skillInput: "" }));
    }
  }

  async function handleGenerateFromScratch() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scratch),
      });
      if (res.ok) onScratchComplete();
      else setUploadError("Generation failed — please try again.");
    } catch {
      setUploadError("Network error — please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Your resume is the foundation
        </h2>
        <p className="text-zinc-400 mt-2 text-base">
          The AI uses your existing resume to give better, more personalised suggestions.
        </p>
      </div>

      {/* Mode selector */}
      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Upload */}
          <button
            onClick={() => setMode("upload")}
            className="group flex flex-col items-start gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-emerald-500/50 hover:bg-zinc-800/60 transition-all duration-200 text-left"
          >
            <span className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Upload size={22} />
            </span>
            <div>
              <p className="text-base font-bold text-white">I have a resume</p>
              <p className="text-sm text-zinc-500 mt-1">
                Upload PDF or DOCX — we'll extract text automatically.
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-emerald-400 transition-colors mt-auto" />
          </button>

          {/* Build from scratch */}
          <button
            onClick={() => setMode("scratch")}
            className="group flex flex-col items-start gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-blue-500/50 hover:bg-zinc-800/60 transition-all duration-200 text-left"
          >
            <span className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <FileText size={22} />
            </span>
            <div>
              <p className="text-base font-bold text-white">Build from scratch</p>
              <p className="text-sm text-zinc-500 mt-1">
                Answer a few questions and we'll generate your resume.
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-blue-400 transition-colors mt-auto" />
          </button>
        </div>
      )}

      {/* Upload mode */}
      {mode === "upload" && (
        <div className="space-y-4">
          <button
            onClick={() => { setMode(null); setUploaded(null); setUploadError(null); }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>

          {!uploaded ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200",
                isDragging
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {isUploading ? (
                <>
                  <Loader2 size={32} className="text-emerald-400 animate-spin" />
                  <p className="text-sm text-zinc-400">Extracting text…</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Upload size={24} className="text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-300">
                      Drop your resume here, or{" "}
                      <span className="text-emerald-400">click to browse</span>
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">PDF or DOCX · Max 10MB</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Resume uploaded!</p>
                  <p className="text-xs text-zinc-500">Text extracted successfully.</p>
                </div>
              </div>
              {uploaded.rawTextPreview && (
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Preview (first 200 chars)</p>
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-4">
                    {uploaded.rawTextPreview.slice(0, 200)}…
                  </p>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                ✓ This looks right — click <strong className="text-zinc-300">Continue</strong> to proceed.
              </p>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <X size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{uploadError}</p>
            </div>
          )}
        </div>
      )}

      {/* Build from scratch mode */}
      {mode === "scratch" && (
        <div className="space-y-6">
          <button
            onClick={() => { setMode(null); setScratchStep(1); }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>

          {/* Progress within scratch */}
          <div className="flex gap-2">
            {[1,2,3,4,5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  s < scratchStep ? "bg-emerald-500" : s === scratchStep ? "bg-emerald-500/50" : "bg-zinc-800"
                )}
              />
            ))}
          </div>

          {/* Section 1: Contact */}
          {scratchStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Contact info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["name","email","phone","location"] as const).map((k) => (
                  <input
                    key={k}
                    type="text"
                    placeholder={{ name: "Full name", email: "Email address", phone: "Phone number", location: "City, Country" }[k]}
                    value={scratch[k]}
                    onChange={(e) => setScratch((p) => ({ ...p, [k]: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                  />
                ))}
                <input
                  type="url"
                  placeholder="LinkedIn URL (optional)"
                  value={scratch.linkedin}
                  onChange={(e) => setScratch((p) => ({ ...p, linkedin: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
                <input
                  type="url"
                  placeholder="GitHub URL (optional)"
                  value={scratch.github}
                  onChange={(e) => setScratch((p) => ({ ...p, github: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Section 2: Current role */}
          {scratchStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Current role</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Job title (or 'Student')"
                  value={scratch.currentRole}
                  onChange={(e) => setScratch((p) => ({ ...p, currentRole: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Company (or university)"
                  value={scratch.currentCompany}
                  onChange={(e) => setScratch((p) => ({ ...p, currentCompany: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Section 3: Education */}
          {scratchStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Education</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="University / College"
                  value={scratch.university}
                  onChange={(e) => setScratch((p) => ({ ...p, university: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors col-span-full"
                />
                <input
                  type="text"
                  placeholder="Degree (e.g. B.Tech Computer Science)"
                  value={scratch.degree}
                  onChange={(e) => setScratch((p) => ({ ...p, degree: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Graduation year"
                  value={scratch.gradYear}
                  onChange={(e) => setScratch((p) => ({ ...p, gradYear: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Section 4: Skills */}
          {scratchStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Top skills</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. React, Python, SQL…"
                  value={scratch.skillInput}
                  onChange={(e) => setScratch((p) => ({ ...p, skillInput: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={addSkill}
                  className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {scratch.skills.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300"
                  >
                    {s}
                    <button
                      onClick={() => setScratch((p) => ({ ...p, skills: p.skills.filter((x) => x !== s) }))}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              {scratch.skills.length === 0 && (
                <p className="text-xs text-zinc-600">Add at least 3 skills for the best results.</p>
              )}
            </div>
          )}

          {/* Section 5: Certs & Projects */}
          {scratchStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Certifications & projects</h3>
              <textarea
                rows={5}
                placeholder={"e.g.\n- AWS Certified Solutions Architect (2024)\n- Built a full-stack e-commerce app with React + Node\n- Won 1st place at college hackathon 2023"}
                value={scratch.certifications}
                onChange={(e) => setScratch((p) => ({ ...p, certifications: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none transition-colors"
              />
              <p className="text-xs text-zinc-600">Free-form is fine. The AI will structure it properly.</p>
            </div>
          )}

          {/* Scratch navigation */}
          <div className="flex gap-3 pt-2">
            {scratchStep > 1 && (
              <button
                onClick={() => setScratchStep((s) => s - 1)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              >
                Back
              </button>
            )}
            {scratchStep < 5 ? (
              <button
                onClick={() => setScratchStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleGenerateFromScratch}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors disabled:opacity-60"
              >
                {isGenerating ? (
                  <><Loader2 size={14} className="animate-spin" /> Generating…</>
                ) : (
                  <>Generate my resume <ArrowRight size={16} /></>
                )}
              </button>
            )}
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <X size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{uploadError}</p>
            </div>
          )}
        </div>
      )}

      {/* Resume rules accordion — always visible regardless of mode */}
      {(mode === "upload" || mode === "scratch" || mode === null) && (
        <ResumeRulesAccordion rules={rules} onChange={onRulesChange} />
      )}

      {/* Skip link */}
      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          Skip for now — I'll add my resume later
        </button>
        <p className="text-xs text-zinc-700 mt-1">
          The AI will still work, but suggestions will be less personalised.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — GitHub
// ---------------------------------------------------------------------------

function Step3GitHub({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [mode, setMode] = useState<"connect" | "no_github" | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          One-click portfolio deployment
        </h2>
        <p className="text-zinc-400 mt-2 text-base">
          Connect GitHub to automatically deploy your projects as a live portfolio.
        </p>
      </div>

      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Connect GitHub */}
          <button
            onClick={() => setMode("connect")}
            className="group flex flex-col items-start gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-500/50 hover:bg-zinc-800/60 transition-all duration-200 text-left"
          >
            <span className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 transition-colors">
              <Github size={22} />
            </span>
            <div>
              <p className="text-base font-bold text-white">Connect GitHub</p>
              <p className="text-sm text-zinc-500 mt-1">
                Deploy projects with one click from your repos.
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-violet-400 transition-colors mt-auto" />
          </button>

          {/* No GitHub */}
          <button
            onClick={() => setMode("no_github")}
            className="group flex flex-col items-start gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-200 text-left"
          >
            <span className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:text-zinc-300 transition-colors">
              <Briefcase size={22} />
            </span>
            <div>
              <p className="text-base font-bold text-white">I don't have GitHub</p>
              <p className="text-sm text-zinc-500 mt-1">
                We'll guide you to create a free account.
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors mt-auto" />
          </button>
        </div>
      )}

      {mode === "connect" && (
        <div className="space-y-4">
          <button
            onClick={() => setMode(null)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Github size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Connect GitHub</p>
                <p className="text-xs text-zinc-500">
                  Secure OAuth flow with GitHub.
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              After connecting, return here and click "I've connected GitHub" below to continue.
              You can also connect from <strong className="text-zinc-400">Settings → Connected Accounts</strong> at any time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/api/portfolio/github-auth"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
              >
                <Github size={15} />
                Connect GitHub
              </a>
              <button
                onClick={onComplete}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium transition-colors"
              >
                <CheckCircle2 size={15} />
                I've connected GitHub
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "no_github" && (
        <div className="space-y-4">
          <button
            onClick={() => setMode(null)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
            <p className="text-sm font-semibold text-white">
              No GitHub? Create one free at{" "}
              <span className="text-violet-400">github.com</span> — takes 2 minutes.
            </p>
            <ol className="space-y-3">
              {[
                "Go to github.com/signup",
                "Create a free account",
                "Come back here and connect it",
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-400">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href="https://github.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-colors border border-zinc-700"
              >
                <Github size={15} />
                Open github.com
              </a>
              <button
                onClick={onSkip}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip */}
      {!mode && (
        <div className="text-center pt-2">
          <button
            onClick={onSkip}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------

function SuccessScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-8 py-8">
      {/* Animated rocket */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse">
          <Rocket size={44} className="text-emerald-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check size={16} className="text-zinc-950" />
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white">You're all set! 🚀</h2>
        <p className="text-zinc-400 mt-3 text-base max-w-sm">
          Career Autopilot is ready. Log your first achievement and watch the AI
          do its magic.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-base transition-all duration-200 shadow-xl shadow-emerald-500/25"
        >
          Start logging achievements
          <ArrowRight size={18} />
        </button>
      </div>

      <p className="text-xs text-zinc-600">
        You can always update your profile and resume in{" "}
        <span className="text-zinc-400">Settings</span>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const DEFAULT_RULES: ResumeRules = {
  maxPages: null,
  focus: "balanced",
  excludeSections: [],
  customInstruction: "",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState<VoiceProfile>({
    fullName: "",
    jobTitle: "",
    industry: "",
    motivation: null,
  });
  const [rules, setRules] = useState<ResumeRules>(DEFAULT_RULES);
  const [uploadedResume, setUploadedResume] = useState<UploadedResume | null>(null);

  const canProceedStep1 = profile.fullName.trim().length > 0;

  const handleComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          voiceProfile: {
            fullName: profile.fullName,
            jobTitle: profile.jobTitle,
            industry: profile.industry,
            motivation: profile.motivation,
          },
          resumeRules: rules,
        }),
      });
    } catch (err) {
      console.error("[onboarding] Failed to mark complete:", err);
    } finally {
      setIsSaving(false);
      setIsDone(true);
    }
  }, [profile, rules]);

  function handleGoToApp() {
    router.push("/achievement/new");
  }

  if (isDone) {
    return <SuccessScreen onStart={handleGoToApp} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Step indicator */}
      <StepIndicator current={step} total={3} />

      {/* Step content */}
      <div className="transition-all duration-300">
        {step === 1 && (
          <Step1Profile profile={profile} onChange={setProfile} />
        )}
        {step === 2 && (
          <Step2Resume
            rules={rules}
            onRulesChange={setRules}
            onUploadSuccess={(r) => { setUploadedResume(r); }}
            onSkip={() => setStep(3)}
            onScratchComplete={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3GitHub
            onComplete={handleComplete}
            onSkip={handleComplete}
          />
        )}
      </div>

      {/* Navigation footer */}
      {(step === 1 || (step === 2 && !isSaving)) && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-600">
            {step === 1 && "This takes about 2 minutes."}
            {step === 2 && "You can always upload your resume later in Settings."}
          </div>
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !canProceedStep1}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                canProceedStep1 || step > 1
                  ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
            >
              {step === 2
                ? uploadedResume
                  ? "This looks right — Continue"
                  : "Continue"
                : "Continue"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Saving state */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 py-4 text-zinc-400 text-sm">
          <Loader2 size={16} className="animate-spin text-emerald-400" />
          Saving your preferences…
        </div>
      )}
    </div>
  );
}
