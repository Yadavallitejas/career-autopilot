import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ---------------------------------------------------------------------------
// Singleton clients — instantiated at module level with process.env directly
// so they pick up the key at call time rather than at module load, avoiding
// issues in environments where env vars are injected late.
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY ?? '',
  baseURL: 'https://api.x.ai/v1'
})

// ---------------------------------------------------------------------------
// Backward-compat getters (kept so existing callers don't break)
// ---------------------------------------------------------------------------

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  return anthropic
}

export function getXaiClient(): OpenAI {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured')
  }
  return grok
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AiMessage = { role: 'user' | 'assistant'; content: string }

// ---------------------------------------------------------------------------
// callAI — primary interface (system + prompt pair)
// ---------------------------------------------------------------------------

export interface CallAIOptions {
  system: string
  prompt: string
  maxTokens?: number
}

/**
 * Calls Claude Sonnet as primary, falls back to Grok-3-mini on rate-limit /
 * quota / overload errors (429, 402, 529).
 *
 * Any other Anthropic error is re-thrown immediately unless XAI_API_KEY is
 * available, in which case we also fall back to Grok.
 */
export async function callAI({
  system,
  prompt,
  maxTokens = 1000,
}: CallAIOptions): Promise<string> {
  // Guard: if no API keys, fail fast
  if (!process.env.ANTHROPIC_API_KEY && !process.env.XAI_API_KEY) {
    console.error('[AI] No API keys configured!')
    throw new Error('No AI API keys configured. Please set ANTHROPIC_API_KEY.')
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0]
      if (text.type !== 'text') throw new Error('Unexpected response type from Anthropic')
      console.log('[AI] Anthropic success, tokens:', response.usage.output_tokens)
      return text.text
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Anthropic.APIStatusError &&
        [429, 402, 529].includes(error.status)
      if (isRateLimit) {
        console.warn('[AI] Anthropic rate limited, falling back to Grok')
      } else {
        console.error('[AI] Anthropic error:', error)
        if (!process.env.XAI_API_KEY) throw error
      }
    }
  }

  // Grok fallback
  if (process.env.XAI_API_KEY) {
    try {
      const response = await grok.chat.completions.create({
        model: 'grok-3-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      })
      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from Grok')
      console.log('[AI] Grok fallback success')
      return content
    } catch (error) {
      console.error('[AI] Grok also failed:', error)
      throw error
    }
  }

  throw new Error('All AI providers failed or not configured')
}

// ---------------------------------------------------------------------------
// callAi — legacy multi-turn interface, delegates to callAI
// ---------------------------------------------------------------------------

export interface AiCallOptions {
  messages: AiMessage[]
  systemPrompt?: string
  maxTokens?: number
  temperature?: number // accepted but not forwarded (kept for API compat)
}

/**
 * Multi-turn message interface — wraps callAI.
 * Converts the messages array into a single user prompt by serialising
 * prior turns as context, then passing the last user message as the prompt.
 */
export async function callAi({
  messages,
  systemPrompt = '',
  maxTokens = 1000,
}: AiCallOptions): Promise<string> {
  const lastMessage = messages[messages.length - 1]
  const priorContext = messages.slice(0, -1)

  const contextBlock =
    priorContext.length > 0
      ? priorContext
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n') + '\n\n'
      : ''

  const prompt = contextBlock + (lastMessage?.content ?? '')

  return callAI({ system: systemPrompt, prompt, maxTokens })
}
