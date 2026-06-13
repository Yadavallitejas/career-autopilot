import { z } from "zod";
import { callAI } from "./client";
import { CLASSIFY_SYSTEM_PROMPT } from "./prompts";

// ---------------------------------------------------------------------------
// Schema — defines and validates the AI response shape
// ---------------------------------------------------------------------------

const ClassificationSchema = z.object({
  resumeScore: z.number().int().min(1).max(10),
  portfolioScore: z.number().int().min(1).max(10),
  achievementType: z.enum([
    "certification",
    "project",
    "award",
    "job_change",
    "education",
    "open_source",
    "publication",
    "other",
  ]),
  reasoning: z.string().min(10).max(500),
  resumeSection: z.string().nullable(),
  resumeBullet: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Return type — schema output + computed boolean flags
// ---------------------------------------------------------------------------

export type ClassificationOutput = z.infer<typeof ClassificationSchema> & {
  resumeWorthy: boolean;
  portfolioWorthy: boolean;
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const RESUME_WORTHY_THRESHOLD = 7;
const PORTFOLIO_WORTHY_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// Safe defaults — returned whenever the AI response cannot be parsed/validated
// ---------------------------------------------------------------------------

const SAFE_DEFAULTS: ClassificationOutput = {
  resumeScore: 5,
  portfolioScore: 4,
  achievementType: "other",
  reasoning: "Classification failed — using defaults",
  resumeSection: null,
  resumeBullet: null,
  resumeWorthy: false,
  portfolioWorthy: false,
};

// ---------------------------------------------------------------------------
// Helper — strip markdown fences the AI may accidentally wrap JSON in
// ---------------------------------------------------------------------------

function stripMarkdownFences(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Classifies a career achievement using Claude (with Grok fallback).
 *
 * Returns scores, achievement type, reasoning, resume bullet, and the
 * computed `resumeWorthy` / `portfolioWorthy` boolean flags that match
 * the DB column names (`classifiedResumeWorthy`, `classifiedPortfolioWorthy`).
 *
 * Never throws — returns SAFE_DEFAULTS on any AI or parse failure.
 */
export async function classifyAchievement({
  rawInput,
  existingResumeText,
  existingPortfolioProjects,
}: {
  rawInput: string;
  existingResumeText: string;
  existingPortfolioProjects: string[];
}): Promise<ClassificationOutput> {
  // Build prompt
  const prompt = `Evaluate this professional achievement and return JSON matching this schema exactly:
{ "resumeScore": 1-10, "portfolioScore": 1-10, "achievementType": one of ["certification","project","award","job_change","education","open_source","publication","other"], "reasoning": "string (10-500 chars)", "resumeSection": "string or null", "resumeBullet": "ATS-optimized bullet or null" }

Achievement: "${rawInput}"

Existing resume context (first 2000 chars): "${existingResumeText.slice(0, 2000)}"

Existing portfolio projects: ${JSON.stringify(existingPortfolioProjects)}

Rules:
- resumeScore >= ${RESUME_WORTHY_THRESHOLD} means resume-worthy → set resumeBullet (format: [Strong action verb] [what] [measurable result if available]) and set resumeSection
- portfolioScore >= ${PORTFOLIO_WORTHY_THRESHOLD} means portfolio-worthy
- resumeBullet format: [Strong action verb] [what] [measurable result if available]
- resumeSection: choose from Certifications, Projects, Experience, Education, Open Source, Awards
- Lower score if the achievement is already represented in the provided resume or portfolio context
- reasoning must explain both scores in plain English (10-500 chars)`;

  // ---------------------------------------------------------------------------
  // 1. Call AI
  // ---------------------------------------------------------------------------

  let rawText: string;
  try {
    rawText = await callAI({
      system: CLASSIFY_SYSTEM_PROMPT,
      prompt,
      maxTokens: 600,
    });
  } catch (aiErr) {
    console.error("[classifyAchievement] AI call failed:", aiErr);
    return { ...SAFE_DEFAULTS };
  }

  // ---------------------------------------------------------------------------
  // 2. Parse JSON
  // ---------------------------------------------------------------------------

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText));
  } catch {
    console.error(
      "[classifyAchievement] JSON.parse failed. Raw response:\n",
      rawText
    );
    return { ...SAFE_DEFAULTS };
  }

  // ---------------------------------------------------------------------------
  // 3. Validate with Zod
  // ---------------------------------------------------------------------------

  const validated = ClassificationSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "[classifyAchievement] Schema validation failed:",
      validated.error.flatten(),
      "\nParsed object:",
      parsed
    );
    // If we at least got a string reasoning from the AI, surface it
    const rawReasoning =
      typeof (parsed as Record<string, unknown>)?.reasoning === "string"
        ? ((parsed as Record<string, unknown>).reasoning as string).slice(
            0,
            500
          )
        : SAFE_DEFAULTS.reasoning;

    return { ...SAFE_DEFAULTS, reasoning: rawReasoning };
  }

  // ---------------------------------------------------------------------------
  // 4. Compute boolean flags and return
  // ---------------------------------------------------------------------------

  const data = validated.data;
  const resumeWorthy = data.resumeScore >= RESUME_WORTHY_THRESHOLD;
  const portfolioWorthy = data.portfolioScore >= PORTFOLIO_WORTHY_THRESHOLD;

  // Enforce business rules: if not resume-worthy, clear the bullet + section
  return {
    ...data,
    resumeBullet: resumeWorthy ? data.resumeBullet : null,
    resumeSection: resumeWorthy ? data.resumeSection : null,
    resumeWorthy,
    portfolioWorthy,
  };
}

// ---------------------------------------------------------------------------
// Backward-compatible type aliases (used by career-coach.ts etc.)
// ---------------------------------------------------------------------------

/** @deprecated Use ClassificationOutput */
export type AchievementType = z.infer<
  typeof ClassificationSchema
>["achievementType"];

/** @deprecated Use ClassificationOutput */
export interface ClassificationResult {
  type: AchievementType;
  resumeScore: number;
  portfolioScore: number;
  resumeReasoning: string;
  portfolioReasoning: string;
}
