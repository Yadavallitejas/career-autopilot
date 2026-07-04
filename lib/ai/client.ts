import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ---------------------------------------------------------------------------
// Singleton clients
// ---------------------------------------------------------------------------

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
}

function getGroq() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY ?? 'not-configured',
    baseURL: 'https://api.groq.com/openai/v1'
  })
}

function getGemini() {
  const key = process.env.GEMINI_API_KEY
  return key ? new GoogleGenerativeAI(key) : null
}

// ---------------------------------------------------------------------------
// Shared types (unchanged)
// ---------------------------------------------------------------------------

export type AiMessage = { role: 'user' | 'assistant'; content: string }

export interface CallAIOptions {
  system: string
  prompt: string
  maxTokens?: number
  jsonMode?: boolean
}

// ---------------------------------------------------------------------------
// callAI — Anthropic → Groq → Gemini fallback chain
// ---------------------------------------------------------------------------

export async function callAI({
  system,
  prompt,
  maxTokens = 1000,
  jsonMode = false,
}: CallAIOptions): Promise<string> {
  // Guard: at least one key must be configured
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error('No AI API keys configured. Add GROQ_API_KEY or GEMINI_API_KEY to your environment.')
  }

  // ── 1. Try Anthropic (primary, when key is set) ──────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await getAnthropic().messages.create({
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
        error instanceof Anthropic.APIError &&
        [429, 402, 529].includes((error as { status: number }).status)
      if (isRateLimit) {
        console.warn('[AI] Anthropic rate limited, trying Groq')
      } else {
        console.error('[AI] Anthropic error:', error)
        // Fall through to Groq regardless — we don't want one bad call to block the pipeline
      }
    }
  }

  // ── 2. Try Groq (Llama 3.3 70B — free, OpenAI-compatible) ───────────────
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await getGroq().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        // Force JSON output when jsonMode is true — eliminates markdown-wrapped JSON failures
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      })
      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from Groq')
      console.log('[AI] Groq success, model: llama-3.3-70b-versatile')
      // Log first 200 chars so you can see real AI output in Vercel logs
      console.log('[AI] Groq response preview:', content.slice(0, 200))
      return content
    } catch (error: unknown) {
      console.error('[AI] Groq failed:', error)
      // Fall through to Gemini
    }
  }

  // ── 3. Try Gemini 2.5 Flash (free fallback, 1500 req/day) ───────────────
  const geminiClient = getGemini()
  if (geminiClient && process.env.GEMINI_API_KEY) {
    try {
      const model = geminiClient.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          maxOutputTokens: maxTokens,
          // Tell Gemini to return JSON when jsonMode is true
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      })

      // Gemini doesn't have a separate system role — prepend it to the user prompt
      const fullPrompt = system ? `${system}\n\n${prompt}` : prompt
      const result = await model.generateContent(fullPrompt)
      const text = result.response.text()

      if (!text) throw new Error('Empty response from Gemini')
      console.log('[AI] Gemini 2.5 Flash success')
      console.log('[AI] Gemini response preview:', text.slice(0, 200))
      return text
    } catch (error) {
      console.error('[AI] Gemini also failed:', error)
    }
  }

  throw new Error('All AI providers failed. Check your API keys and rate limits.')
}

// ---------------------------------------------------------------------------
// Backward-compat getters (kept so existing callers don't break)
// ---------------------------------------------------------------------------

export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')
  return getAnthropic()
}

// ---------------------------------------------------------------------------
// callAi — legacy multi-turn interface, delegates to callAI (unchanged)
// ---------------------------------------------------------------------------

export interface AiCallOptions {
  messages: AiMessage[]
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

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