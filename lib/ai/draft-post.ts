import { z } from "zod";
import { callAI } from "./client";
import { LINKEDIN_SYSTEM_PROMPT, X_SYSTEM_PROMPT } from "./prompts";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const LinkedInSchema = z.object({
  draftText: z.string().min(1),
  hashtags: z.array(z.string()).min(1).max(10),
  mediaPrompt: z.string(),
});

const XSchema = z.object({
  draftText: z.string().min(1),
  thread: z
    .array(z.string())
    .optional()
    .transform((v): string[] => v ?? []),
  hashtags: z
    .array(z.string())
    .optional()
    .transform((v): string[] => v ?? []),
});

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type LinkedInDraft = z.infer<typeof LinkedInSchema>;
export type XDraft = z.infer<typeof XSchema>;

// ---------------------------------------------------------------------------
// Safe defaults
// ---------------------------------------------------------------------------

const LINKEDIN_DEFAULTS: LinkedInDraft = {
  draftText:
    "Just logged a new career achievement. More details to follow — excited to share the full story soon.",
  hashtags: ["career", "growth", "learning"],
  mediaPrompt: "A screenshot or visual summarising the achievement.",
};

const X_DEFAULTS: XDraft = {
  draftText: "New achievement unlocked. Details coming soon.",
  thread: [],
  hashtags: ["career"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Truncates a string to maxLen characters at the last word boundary.
 * Appends "…" if truncation occurred.
 */
function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Back up from maxLen to find the last space
  const cut = text.lastIndexOf(" ", maxLen - 1);
  const end = cut > 0 ? cut : maxLen - 1;
  return text.slice(0, end) + "…";
}

/**
 * Shared safe-parse utility.
 * Returns null on any JSON or Zod failure; the caller provides defaults.
 */
function safeParse<T>(
  raw: string,
  schema: z.ZodType<T>,
  label: string
): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(raw));
  } catch {
    console.error(`[${label}] JSON.parse failed. Raw:\n`, raw);
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(
      `[${label}] Schema validation failed:`,
      result.error.flatten(),
      "\nParsed:", parsed
    );
    return null;
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// draftLinkedInPost
// ---------------------------------------------------------------------------

export async function draftLinkedInPost({
  rawInput,
  achievementType,
  reasoning,
  voiceProfile,
}: {
  rawInput: string;
  achievementType: string;
  reasoning: string;
  voiceProfile: Record<string, unknown> | null;
}): Promise<LinkedInDraft> {
  const voiceLine = voiceProfile
    ? `Voice style to match: ${JSON.stringify(voiceProfile)}`
    : "";

  const prompt = `Write a high-performing LinkedIn post about this achievement. Return JSON:
{ "draftText": string, "hashtags": string[], "mediaPrompt": string }

Achievement: "${rawInput}"
Type: ${achievementType}
Context: ${reasoning}
${voiceLine}

Rules for draftText:
- First line: hook that does NOT start with 'I am excited', 'I am happy', 'Thrilled to', 'Happy to', or 'Excited to'
- Include a personal insight or lesson learned (2-3 sentences)
- End with an engagement question
- 150-300 words total
- Do NOT use more than 2 emojis total

Rules for hashtags: 3-5 relevant tags, no # prefix, lowercase_with_underscores or camelCase
Rules for mediaPrompt: specific description of an image or screenshot that would enhance this post`;

  let raw: string;
  try {
    raw = await callAI({
      system: LINKEDIN_SYSTEM_PROMPT,
      prompt,
      maxTokens: 800,
      jsonMode: true,
    });
  } catch (err) {
    console.error("[draftLinkedInPost] AI call failed:", err);
    return { ...LINKEDIN_DEFAULTS };
  }

  const result = safeParse(raw, LinkedInSchema, "draftLinkedInPost");
  if (!result) return { ...LINKEDIN_DEFAULTS };

  // Clamp hashtags to 5
  return {
    ...result,
    hashtags: result.hashtags.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// draftXPost
// ---------------------------------------------------------------------------

const X_MAX_CHARS = 280;

export async function draftXPost({
  rawInput,
  achievementType,
  voiceProfile,
}: {
  rawInput: string;
  achievementType: string;
  voiceProfile: Record<string, unknown> | null;
}): Promise<XDraft> {
  const voiceLine = voiceProfile
    ? `Voice style to match: ${JSON.stringify(voiceProfile)}`
    : "";

  const prompt = `Write a tweet about this achievement. Return JSON:
{ "draftText": string, "thread": string[], "hashtags": string[] }

Achievement: "${rawInput}"
Type: ${achievementType}
${voiceLine}

Rules:
- draftText: max ${X_MAX_CHARS} characters, direct and punchy, different angle from LinkedIn
- thread: array of up to 3 continuation tweets if the topic warrants depth, else empty array []
- Each thread tweet also max ${X_MAX_CHARS} chars
- hashtags: 2-3 tags max, no # prefix`;

  let raw: string;
  try {
    raw = await callAI({
      system: X_SYSTEM_PROMPT,
      prompt,
      maxTokens: 600,
      jsonMode: true,
    });
  } catch (err) {
    console.error("[draftXPost] AI call failed:", err);
    return { ...X_DEFAULTS };
  }

  const result = safeParse(raw, XSchema, "draftXPost");
  if (!result) return { ...X_DEFAULTS };

  // Enforce 280-char hard limit on draftText (AI sometimes ignores it)
  const draftText = truncateAtWordBoundary(result.draftText, X_MAX_CHARS);

  // Enforce 280-char limit on each thread tweet too
  const thread = (result.thread ?? [])
    .slice(0, 3)
    .map((t) => truncateAtWordBoundary(t, X_MAX_CHARS));

  return {
    draftText,
    thread,
    hashtags: (result.hashtags ?? []).slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Backward-compat exports (old draftPosts function + DraftedPosts type)
// ---------------------------------------------------------------------------

export interface DraftedPosts {
  linkedin: {
    content: string;
    hashtags: string[];
    mediaSuggestion: string;
  };
  x: {
    tweet: string;
    thread: string[];
    mediaSuggestion: string;
  };
}

/**
 * @deprecated Use draftLinkedInPost and draftXPost directly.
 * Kept for backward compatibility.
 */
export async function draftPosts(
  achievementText: string,
  achievementType: string
): Promise<DraftedPosts> {
  const [linkedin, x] = await Promise.all([
    draftLinkedInPost({
      rawInput: achievementText,
      achievementType,
      reasoning: "",
      voiceProfile: null,
    }),
    draftXPost({
      rawInput: achievementText,
      achievementType,
      voiceProfile: null,
    }),
  ]);

  return {
    linkedin: {
      content: linkedin.draftText,
      hashtags: linkedin.hashtags,
      mediaSuggestion: linkedin.mediaPrompt,
    },
    x: {
      tweet: x.draftText,
      thread: x.thread,
      mediaSuggestion: "",
    },
  };
}
