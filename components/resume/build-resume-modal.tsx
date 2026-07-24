"use client";

import { useState, useTransition } from "react";
import {
  X,
  Plus,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  present: boolean;
  bullets: string; // each line becomes a bullet
}

interface EduEntry {
  institution: string;
  degree: string;
  field: string;
  graduationYear: string;
  gpa: string;
}

interface CertEntry {
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
}

type BuildStep =
  | "template"
  | "basic"
  | "experience"
  | "education"
  | "skills"
  | "preview";

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const FIELD_CLS =
  "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-muted-foreground mb-1 block">
      {children}
    </span>
  );
}

function buildEmptyExp(): ExpEntry {
  return { company: "", title: "", startDate: "", endDate: "", present: false, bullets: "" };
}
function buildEmptyEdu(): EduEntry {
  return { institution: "", degree: "", field: "", graduationYear: "", gpa: "" };
}
function buildEmptyCert(): CertEntry {
  return { name: "", issuer: "", date: "", credentialId: "" };
}

function EntryCard({
  index,
  total,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Entry {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Skill pill tag input
function SkillPillInput({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (s: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addSkill() {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-muted border border-border rounded-lg cursor-text">
        {skills.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(skills.filter((sk) => sk !== s))}
              className="hover:text-destructive transition-colors leading-none"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
            if (e.key === "Backspace" && !input && skills.length > 0) {
              onChange(skills.slice(0, -1));
            }
          }}
          onBlur={addSkill}
          placeholder={
            skills.length === 0
              ? "Type a skill, press Enter or comma…"
              : "Add more…"
          }
          className="flex-1 min-w-[140px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Press Enter or comma to add each skill. Backspace to remove the last.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildResumeModal — main export
// ---------------------------------------------------------------------------

export function BuildResumeModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<BuildStep>("template");
  const [isPending, startTransition] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<
    "classic" | "modern" | "minimal"
  >("classic");

  const TEMPLATES: {
    id: "classic" | "modern" | "minimal";
    name: string;
    tag: string;
    sub: string;
    rec: string;
  }[] = [
    {
      id: "classic",
      name: "Classic",
      tag: "Single column",
      sub: "ATS-friendly",
      rec: "Recommended for job applications",
    },
    {
      id: "modern",
      name: "Modern",
      tag: "Two column",
      sub: "With sidebar",
      rec: "Good for developers",
    },
    {
      id: "minimal",
      name: "Minimal",
      tag: "Clean, simple",
      sub: "One page",
      rec: "Best for freshers",
    },
  ];

  // Personal info
  const [basic, setBasic] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    summary: "",
  });

  // Experience
  const [experiences, setExperiences] = useState<ExpEntry[]>([buildEmptyExp()]);

  // Education
  const [educations, setEducations] = useState<EduEntry[]>([buildEmptyEdu()]);

  // Skills
  const [skills, setSkills] = useState<string[]>([]);

  // Certifications
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const STEPS: BuildStep[] = [
    "template",
    "basic",
    "experience",
    "education",
    "skills",
    "preview",
  ];
  const STEP_LABELS: Record<BuildStep, string> = {
    template: "Template",
    basic: "Personal Info",
    experience: "Experience",
    education: "Education",
    skills: "Skills & Certs",
    preview: "Generating",
  };
  const stepIndex = STEPS.indexOf(step);

  // ── Entry helpers ──────────────────────────────────────────────────────────

  function updateExp(i: number, patch: Partial<ExpEntry>) {
    setExperiences((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  }
  function updateEdu(i: number, patch: Partial<EduEntry>) {
    setEducations((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  }
  function updateCert(i: number, patch: Partial<CertEntry>) {
    setCerts((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerateError(null);
    setStep("preview");
    startTransition(async () => {
      // "minimal" uses the classic template engine but the name is stored
      const templateId =
        selectedTemplate === "minimal" ? "classic" : selectedTemplate;

      const resumeData = {
        fullName: basic.fullName,
        email: basic.email,
        phone: basic.phone || undefined,
        location: basic.location || undefined,
        linkedinUrl: basic.linkedin || undefined,
        githubUrl: basic.github || undefined,
        summary: basic.summary || undefined,
        templateId,
        experience: experiences
          .filter((e) => e.company.trim() || e.title.trim())
          .map((e) => ({
            company: e.company.trim() || "—",
            title: e.title.trim() || "Role",
            startDate: e.startDate || new Date().getFullYear().toString(),
            endDate: e.present ? undefined : (e.endDate || undefined),
            bullets: e.bullets
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          })),
        education: educations
          .filter((e) => e.institution.trim())
          .map((e) => ({
            institution: e.institution.trim(),
            degree: e.degree.trim() || "Degree",
            graduationYear:
              e.graduationYear || new Date().getFullYear().toString(),
            gpa: e.gpa.trim() || undefined,
          })),
        certifications: certs
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            issuer: c.issuer.trim() || "—",
            date: c.date || undefined,
            url: c.credentialId.trim()
              ? `Credential ID: ${c.credentialId.trim()}`
              : undefined,
          })),
        projects: [],
        skills,
      };

      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeData),
      });

      const json = (await res.json()) as {
        error?: string;
        details?: string[];
      };
      if (res.ok) {
        window.location.reload();
      } else {
        const msg =
          json.details?.join("; ") ??
          json.error ??
          "Generation failed — please try again.";
        setGenerateError(msg);
        setStep("skills");
      }
    });
  }

  // ── Generating screen ──────────────────────────────────────────────────────

  if (step === "preview") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md p-10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Loader2 size={32} className="text-primary animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">
            Building your resume…
          </h2>
          <p className="text-sm text-muted-foreground">
            Generating a polished PDF from your details. This takes a few
            seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  const canAdvance =
    step === "basic"
      ? Boolean(basic.fullName.trim() && basic.email.trim())
      : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Build your resume
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {stepIndex + 1} of {STEPS.length - 1} —{" "}
              {STEP_LABELS[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex px-5 pt-3 gap-1.5 flex-shrink-0">
          {STEPS.filter((s) => s !== "preview").map((s, idx) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-300",
                idx <= stepIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* ── STEP 0: Template ──────────────────────────────────────── */}
          {step === "template" && (
            <>
              <p className="text-xs text-muted-foreground">
                Choose a layout for your PDF resume. You can regenerate later
                with a different template.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      "border rounded-xl p-3 text-left transition-all",
                      selectedTemplate === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-primary mt-0.5">
                      {t.tag}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.sub}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-2 leading-tight">
                      {t.rec}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 1: Personal Info ─────────────────────────────────── */}
          {step === "basic" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["fullName", "Full name *", "Jane Doe"],
                    ["email", "Email *", "jane@example.com"],
                    ["phone", "Phone", "+91 98765 43210"],
                    ["location", "Location", "Bengaluru, India"],
                    ["linkedin", "LinkedIn URL", "linkedin.com/in/jane"],
                    ["github", "GitHub URL", "github.com/jane"],
                  ] as [keyof typeof basic, string, string][]
                ).map(([field, label, placeholder]) => (
                  <label key={field} className="block">
                    <FieldLabel>{label}</FieldLabel>
                    <input
                      type="text"
                      value={basic[field]}
                      onChange={(e) =>
                        setBasic((b) => ({ ...b, [field]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className={FIELD_CLS}
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                <FieldLabel>Professional summary</FieldLabel>
                <textarea
                  value={basic.summary}
                  onChange={(e) =>
                    setBasic((b) => ({ ...b, summary: e.target.value }))
                  }
                  placeholder="Software engineer with 5 years of experience building scalable web applications…"
                  rows={3}
                  className={cn(FIELD_CLS, "resize-none")}
                />
              </label>
            </>
          )}

          {/* ── STEP 2: Experience ────────────────────────────────────── */}
          {step === "experience" && (
            <>
              <p className="text-xs text-muted-foreground">
                Add your work experience. You can skip this if you&apos;re a
                fresher — click Continue.
              </p>
              <div className="space-y-4">
                {experiences.map((exp, i) => (
                  <EntryCard
                    key={i}
                    index={i}
                    total={experiences.length}
                    onRemove={() =>
                      setExperiences((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <FieldLabel>Company name</FieldLabel>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) =>
                            updateExp(i, { company: e.target.value })
                          }
                          placeholder="Acme Corp"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Job title</FieldLabel>
                        <input
                          type="text"
                          value={exp.title}
                          onChange={(e) =>
                            updateExp(i, { title: e.target.value })
                          }
                          placeholder="Senior Engineer"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Start date</FieldLabel>
                        <input
                          type="text"
                          value={exp.startDate}
                          onChange={(e) =>
                            updateExp(i, { startDate: e.target.value })
                          }
                          placeholder="Jan 2022"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>End date</FieldLabel>
                        <input
                          type="text"
                          value={exp.endDate}
                          onChange={(e) =>
                            updateExp(i, { endDate: e.target.value })
                          }
                          placeholder="Dec 2024"
                          disabled={exp.present}
                          className={cn(
                            FIELD_CLS,
                            exp.present &&
                              "opacity-40 cursor-not-allowed"
                          )}
                        />
                        <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={exp.present}
                            onChange={(e) =>
                              updateExp(i, { present: e.target.checked })
                            }
                            className="rounded"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            Present / Current
                          </span>
                        </label>
                      </label>
                    </div>
                    <label className="block">
                      <FieldLabel>
                        Key responsibilities (one per line — each becomes a
                        bullet point)
                      </FieldLabel>
                      <textarea
                        value={exp.bullets}
                        onChange={(e) =>
                          updateExp(i, { bullets: e.target.value })
                        }
                        placeholder={
                          "Led migration from monolith to microservices, reducing deploy time 60%\nBuilt CI/CD pipeline with GitHub Actions, cutting release cycles from 2w to 2d"
                        }
                        rows={4}
                        className={cn(
                          FIELD_CLS,
                          "resize-none font-mono text-xs leading-relaxed"
                        )}
                      />
                    </label>
                  </EntryCard>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setExperiences((prev) => [...prev, buildEmptyExp()])
                }
                className="w-full border border-dashed border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={13} />
                Add another experience
              </button>
            </>
          )}

          {/* ── STEP 3: Education ─────────────────────────────────────── */}
          {step === "education" && (
            <>
              <p className="text-xs text-muted-foreground">
                Add your educational background.
              </p>
              <div className="space-y-4">
                {educations.map((edu, i) => (
                  <EntryCard
                    key={i}
                    index={i}
                    total={educations.length}
                    onRemove={() =>
                      setEducations((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block col-span-2">
                        <FieldLabel>Institution name</FieldLabel>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) =>
                            updateEdu(i, { institution: e.target.value })
                          }
                          placeholder="IIT Bombay"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Degree</FieldLabel>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) =>
                            updateEdu(i, { degree: e.target.value })
                          }
                          placeholder="B.Tech"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Field of study</FieldLabel>
                        <input
                          type="text"
                          value={edu.field}
                          onChange={(e) =>
                            updateEdu(i, { field: e.target.value })
                          }
                          placeholder="Computer Science"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Graduation year</FieldLabel>
                        <input
                          type="text"
                          value={edu.graduationYear}
                          onChange={(e) =>
                            updateEdu(i, { graduationYear: e.target.value })
                          }
                          placeholder="2023"
                          className={FIELD_CLS}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>CGPA / Percentage (optional)</FieldLabel>
                        <input
                          type="text"
                          value={edu.gpa}
                          onChange={(e) =>
                            updateEdu(i, { gpa: e.target.value })
                          }
                          placeholder="8.5 / 10"
                          className={FIELD_CLS}
                        />
                      </label>
                    </div>
                  </EntryCard>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setEducations((prev) => [...prev, buildEmptyEdu()])
                }
                className="w-full border border-dashed border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={13} />
                Add another education
              </button>
            </>
          )}

          {/* ── STEP 4: Skills & Certifications ──────────────────────── */}
          {step === "skills" && (
            <>
              <div>
                <FieldLabel>Skills</FieldLabel>
                <SkillPillInput skills={skills} onChange={setSkills} />
              </div>

              <div className="pt-1">
                <FieldLabel>Certifications</FieldLabel>
                {certs.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mb-3">
                    No certifications yet — add one below if you have any.
                  </p>
                )}
                <div className="space-y-3">
                  {certs.map((cert, i) => (
                    <EntryCard
                      key={i}
                      index={i}
                      total={certs.length}
                      onRemove={() =>
                        setCerts((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block col-span-2">
                          <FieldLabel>Certification name</FieldLabel>
                          <input
                            type="text"
                            value={cert.name}
                            onChange={(e) =>
                              updateCert(i, { name: e.target.value })
                            }
                            placeholder="AWS Solutions Architect"
                            className={FIELD_CLS}
                          />
                        </label>
                        <label className="block">
                          <FieldLabel>Issuer</FieldLabel>
                          <input
                            type="text"
                            value={cert.issuer}
                            onChange={(e) =>
                              updateCert(i, { issuer: e.target.value })
                            }
                            placeholder="Amazon Web Services"
                            className={FIELD_CLS}
                          />
                        </label>
                        <label className="block">
                          <FieldLabel>Date</FieldLabel>
                          <input
                            type="text"
                            value={cert.date}
                            onChange={(e) =>
                              updateCert(i, { date: e.target.value })
                            }
                            placeholder="Mar 2024"
                            className={FIELD_CLS}
                          />
                        </label>
                        <label className="block col-span-2">
                          <FieldLabel>Credential ID (optional)</FieldLabel>
                          <input
                            type="text"
                            value={cert.credentialId}
                            onChange={(e) =>
                              updateCert(i, { credentialId: e.target.value })
                            }
                            placeholder="ABC-12345"
                            className={FIELD_CLS}
                          />
                        </label>
                      </div>
                    </EntryCard>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCerts((prev) => [...prev, buildEmptyCert()])}
                  className="mt-3 w-full border border-dashed border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} />
                  Add certification
                </button>
              </div>

              {generateError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {generateError}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              stepIndex > 0 ? setStep(STEPS[stepIndex - 1]) : onClose()
            }
            className="text-muted-foreground"
          >
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          {step === "skills" ? (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={
                isPending ||
                !basic.fullName.trim() ||
                !basic.email.trim()
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[130px]"
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
              disabled={!canAdvance}
              className="bg-muted hover:bg-muted/80 text-foreground min-w-[100px]"
            >
              Continue
              <ChevronRight size={13} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
