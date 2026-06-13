import Anthropic, { APIError } from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Singleton clients — instantiated once at module level, reused per request
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
});

// ---------------------------------------------------------------------------
// Exported getters (kept for backward compat with existing callers)
// ---------------------------------------------------------------------------

export function getAnthropicClient(): Anthropic {
  return anthropic;
}

export function getXaiClient(): OpenAI {
  return grok;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AiMessage = { role: "user" | "assistant"; content: string };

/** Status codes that should trigger Grok fallback rather than a hard throw */
const FALLBACK_STATUSES = new Set([
  402, // Payment required / quota exhausted
  429, // Rate limit
  529, // Anthropic "overloaded" custom code
]);

// ---------------------------------------------------------------------------
// callAI — the new simple interface (system + prompt pair)
// ---------------------------------------------------------------------------

export interface CallAIOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/**
 * Calls Claude Sonnet as primary, falls back to Grok-3-mini on:
 *   - HTTP 429 (rate limit)
 *   - HTTP 402 (payment / quota)
 *   - HTTP 529 (Anthropic overloaded)
 *
 * Any other Anthropic error is re-thrown immediately.
 * If Grok also fails, the error is logged and re-thrown.
 */
export async function callAI({
  system,
  prompt,
  maxTokens = 1000,
}: CallAIOptions): Promise<string> {
  // 1. Try Anthropic (Claude Sonnet 4.5)
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const firstBlock = response.content[0];
    return firstBlock?.type === "text" ? firstBlock.text : "";
  } catch (err) {
    if (err instanceof APIError && err.status !== undefined) {
      if (FALLBACK_STATUSES.has(err.status)) {
        // Fall through to Grok
        console.warn(
          `[callAI] Anthropic returned ${err.status} — falling back to Grok`
        );
      } else {
        // Hard failure (auth, bad request, etc.) — throw immediately
        throw err;
      }
    } else {
      // Non-HTTP error (network, timeout, etc.) — throw immediately
      throw err;
    }
  }

  // 2. Grok fallback (xAI, OpenAI-compatible)
  try {
    const response = await grok.chat.completions.create({
      model: "grok-3-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (grokErr) {
    console.error("[callAI] Grok fallback also failed:", grokErr);
    throw grokErr;
  }
}

// ---------------------------------------------------------------------------
// callAi — legacy interface used by classify.ts, draft-post.ts, etc.
// Delegates to callAI internally.
// ---------------------------------------------------------------------------

export interface AiCallOptions {
  messages: AiMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number; // accepted but not forwarded (Claude ignores, Grok accepts — kept for API compat)
}

/**
 * Multi-turn message interface — wraps callAI.
 * Converts the messages array into a single user prompt by serialising
 * prior turns as context, then passing the last user message as the prompt.
 */
export async function callAi({
  messages,
  systemPrompt = "",
  maxTokens = 1000,
}: AiCallOptions): Promise<string> {
  // Separate the last user message from the prior context
  const lastMessage = messages[messages.length - 1];
  const priorContext = messages.slice(0, -1);

  // Build a context block so Claude understands prior conversation turns
  const contextBlock =
    priorContext.length > 0
      ? priorContext
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n\n") + "\n\n"
      : "";

  const prompt = contextBlock + (lastMessage?.content ?? "");

  return callAI({ system: systemPrompt, prompt, maxTokens });
}
