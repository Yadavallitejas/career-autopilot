import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Unified AI client with automatic fallback:
 *   Primary  → Anthropic Claude (claude-sonnet-4-6)
 *   Fallback → xAI Grok (grok-3-mini via OpenAI-compatible SDK)
 *
 * Fallback is triggered on HTTP 429, 402, or 529 from Anthropic.
 */

export type AiMessage = { role: "user" | "assistant"; content: string };

export interface AiCallOptions {
  messages: AiMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callAi(options: AiCallOptions): Promise<string> {
  // TODO: implement with primary/fallback chain
  throw new Error("Not implemented");
}

let _anthropic: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

let _xai: OpenAI | null = null;
export function getXaiClient(): OpenAI {
  if (!_xai) {
    _xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    });
  }
  return _xai;
}
