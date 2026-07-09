import { z } from "zod";
import { callAI } from "./client";
import { CLASSIFY_SYSTEM_PROMPT } from "./prompts";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Resume rules type — mirrors users.resumeRules jsonb shape
// ---------------------------------------------------------------------------

export interface ResumeRules {
  maxPages?: 1 | 2 | null;
  focus?: "technical" | "creative" | "balanced";
  excludeSections?: string[];
  customInstruction?: string;
}

// ---------------------------------------------------------------------------
// Redis client — module-level singleton, reused across invocations
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // Redis not configured — skip caching
  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// Schema — defines and validates the AI response shape
// ---------------------------------------------------------------------------

const ClassificationSchema = z.object({
  resumeScore: z.number().int().min(1).max(10).nullable(),
  portfolioScore: z.number().int().min(1).max(10).nullable(),
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
  replaceSuggestion: z.string().nullable(),
  portfolioReplaceSuggestion: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Return type — schema output + computed boolean flags
// ---------------------------------------------------------------------------

export type ClassificationOutput = z.infer<typeof ClassificationSchema> & {
  resumeWorthy: boolean;
  portfolioWorthy: boolean;
  replaceSuggestion: string | null;
  portfolioReplaceSuggestion: string | null;
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
  resumeScore: null,
  portfolioScore: null,
  achievementType: "other",
  reasoning: "Classification failed — using defaults",
  resumeSection: null,
  resumeBullet: null,
  resumeWorthy: false,
  portfolioWorthy: false,
  replaceSuggestion: null,
  portfolioReplaceSuggestion: null,
};

// ---------------------------------------------------------------------------
// Helper — strip markdown fences the AI may accidentally wrap JSON in
// ---------------------------------------------------------------------------

export function stripMarkdownFences(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Helper — builds the resume-rules block appended to the classify prompt
// ---------------------------------------------------------------------------

export function buildResumeRulesBlock(rules?: ResumeRules | null): string {
  if (!rules) return "";

  const lines: string[] = ["\n\nUser resume preferences (respect these when generating the bullet and choosing a section):"];

  if (rules.maxPages === 1) {
    lines.push("- Target a 1-page resume — keep bullets concise (under 20 words each).");
  } else if (rules.maxPages === 2) {
    lines.push("- Target a 2-page resume — more detail is acceptable.");
  }

  if (rules.focus === "technical") {
    lines.push("- Writing focus: technical / ATS-optimised — use precise keywords, metrics, and tech stack names.");
  } else if (rules.focus === "creative") {
    lines.push("- Writing focus: creative / human — prefer natural language over keyword stuffing.");
  }

  if (rules.excludeSections && rules.excludeSections.length > 0) {
    lines.push(`- Do NOT place this bullet in the following sections: ${rules.excludeSections.join(", ")}.`);
  }

  if (rules.customInstruction?.trim()) {
    lines.push(`- Special instruction from user: "${rules.customInstruction.trim()}"`);
  }

  return lines.length > 1 ? lines.join("\n") : "";
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
  mediaContext = "",
  existingResumeText,
  existingPortfolioProjects,
  hasPortfolio,
  resumeRules,
}: {
  rawInput: string;
  /** Extracted text or AI description from an attached PDF/image */
  mediaContext?: string;
  /** null = user has no resume connected */
  existingResumeText: string | null;
  existingPortfolioProjects: string[];
  /** false = user has no portfolio connected; score should be null */
  hasPortfolio: boolean;
  /** Optional per-user resume preferences — injected into the prompt when present */
  resumeRules?: ResumeRules | null;
}): Promise<ClassificationOutput> {
  // ---------------------------------------------------------------------------
  // 0. Cache check — hash rawInput + mediaContext so different media yields
  //    different cache entries even when the text is identical.
  // ---------------------------------------------------------------------------
  const redis = getRedis();
  const cacheKey = `classify:${crypto
    .createHash('sha256')
    .update(rawInput + mediaContext)
    .digest('hex')
    .slice(0, 16)}`;

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        console.log('[classifyAchievement] Cache hit:', cacheKey);
        return JSON.parse(cached) as ClassificationOutput;
      }
    } catch (cacheErr) {
      // Non-fatal — proceed without cache
      console.warn('[classifyAchievement] Redis get failed (non-fatal):', cacheErr);
    }
  }

  // ---------------------------------------------------------------------------
  // No-resume early return — don't attempt scoring without context
  // ---------------------------------------------------------------------------
  if (existingResumeText === null) {
    return {
      resumeScore: null,
      resumeWorthy: false,
      portfolioScore: null,
      portfolioWorthy: false,
      achievementType: "other",
      reasoning: "No resume connected — upload your resume for personalized scoring.",
      resumeSection: null,
      resumeBullet: null,
      replaceSuggestion: null,
      portfolioReplaceSuggestion: null,
    };
  }

  const mediaContextBlock = mediaContext?.trim()
    ? `\nACHIEVEMENT MEDIA CONTEXT (certificate text or image analysis):\n${mediaContext}`
    : "";

  const portfolioBlock = hasPortfolio
    ? `USER'S PORTFOLIO PROJECTS:\n${existingPortfolioProjects.join("\n") || "(none listed)"}`
    : `USER HAS NO PORTFOLIO CONNECTED: set portfolioScore to null, portfolioWorthy to false, portfolioReplaceSuggestion to null.`;

  const prompt = `You are analyzing whether a professional achievement should be added to 
THIS specific person's resume and portfolio — not whether it's good in general.

USER'S CURRENT RESUME:
${existingResumeText.slice(0, 4000)}

ACHIEVEMENT BEING EVALUATED:
${rawInput}${mediaContextBlock}

${portfolioBlock}

Return JSON with EXACTLY these fields:
{ "resumeScore": number (1-10) | null, "portfolioScore": number (1-10) | null, "achievementType": one of ["certification","project","award","job_change","education","open_source","publication","other"], "reasoning": string (10-500 chars), "resumeSection": string | null, "resumeBullet": string | null, "replaceSuggestion": string | null, "portfolioReplaceSuggestion": string | null }

Answer these specific questions:

1. RESUME: Does adding this achievement make THIS person's resume stronger?
   - Compare it against what's already there. Is it better than their weakest existing certification/experience? Would a recruiter value this more than something already listed?
   - If yes (resumeScore >= ${RESUME_WORTHY_THRESHOLD}): set resumeBullet (format: [Strong action verb] [what] [measurable result]) and resumeSection (one of: Certifications, Projects, Experience, Education, Open Source, Awards). If there is a weaker existing item to replace, name it specifically in replaceSuggestion (e.g. "Consider removing your 2021 Udemy HTML course"). Otherwise set replaceSuggestion to null.
   - If the resume is sparse (few entries): almost anything real-world adds value.
   - If the resume is already strong: hold a higher standard.

2. PORTFOLIO: Same logic — does this achievement (if it's a project/deployment) improve the portfolio vs what's already there? If portfolio not connected, return null for portfolioScore.
   - If portfolioScore >= ${PORTFOLIO_WORTHY_THRESHOLD} and there is a weaker portfolio item to replace, name it in portfolioReplaceSuggestion. Otherwise null.

- reasoning must be comparative and specific to this person's resume (10-500 chars)
- Lower score if this achievement is already represented in their resume/portfolio${buildResumeRulesBlock(resumeRules)}`;

  // ---------------------------------------------------------------------------
  // 1. Call AI
  // ---------------------------------------------------------------------------

  let rawText: string;
  try {
    rawText = await callAI({
      system: CLASSIFY_SYSTEM_PROMPT,
      prompt,
      maxTokens: 600,
      jsonMode: true,
    });
  } catch (aiErr) {
    console.error("[classifyAchievement] AI call failed:", aiErr);
    return { ...SAFE_DEFAULTS };
  }

  console.log('[Classify] Raw AI response (first 500 chars):', rawText.slice(0, 500));

  // ---------------------------------------------------------------------------
  // 2. Parse JSON
  // ---------------------------------------------------------------------------

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText));
  } catch (parseError) {
    console.error('[Classify] JSON parse failed. Raw response was:', rawText);
    console.error('[Classify] Parse error:', parseError);
    return { ...SAFE_DEFAULTS };
  }

  // ---------------------------------------------------------------------------
  // 3. Validate with Zod
  // ---------------------------------------------------------------------------

  const validated = ClassificationSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('[Classify] Schema validation failed:', validated.error.issues);
    console.error('[Classify] Parsed object was:', parsed);
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
  const resumeWorthy = (data.resumeScore ?? 0) >= RESUME_WORTHY_THRESHOLD;
  const portfolioWorthy = (data.portfolioScore ?? 0) >= PORTFOLIO_WORTHY_THRESHOLD;

  // Enforce business rules: if not resume-worthy, clear the bullet + section + replace hint
  const result: ClassificationOutput = {
    ...data,
    resumeBullet: resumeWorthy ? data.resumeBullet : null,
    resumeSection: resumeWorthy ? data.resumeSection : null,
    replaceSuggestion: resumeWorthy ? (data.replaceSuggestion ?? null) : null,
    portfolioReplaceSuggestion: portfolioWorthy ? (data.portfolioReplaceSuggestion ?? null) : null,
    resumeWorthy,
    portfolioWorthy,
  };

  // ---------------------------------------------------------------------------
  // 5. Write to cache (1 hour TTL) — fire-and-forget, non-fatal
  // ---------------------------------------------------------------------------
  if (redis) {
    redis
      .set(cacheKey, JSON.stringify(result), { ex: 3600 })
      .catch((e) => console.warn('[classifyAchievement] Redis set failed (non-fatal):', e));
  }

  return result;
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
