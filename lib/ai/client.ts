import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/lib/env'

// ---------------------------------------------------------------------------
// Singleton clients — built once at module load time
// ---------------------------------------------------------------------------

// Groq: PRIMARY — free tier, extremely fast (llama-3.3-70b on OpenAI-compatible API)
const groq = env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null

// Gemini: FALLBACK — free (1 500 req/day on Flash), handles PDFs natively
// Also the primary PDF processor since Groq has no native PDF support.
const gemini = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

const GROQ_TEXT_MODEL   = 'llama-3.3-70b-versatile'
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const GEMINI_MODEL      = 'gemini-2.0-flash'   // free, fast, supports PDFs + images

// ---------------------------------------------------------------------------
// Shared types (existing CallAIOptions interface — unchanged for callers)
// ---------------------------------------------------------------------------

export type AiMessage = { role: 'user' | 'assistant'; content: string }

/** Core options used by all callers (object-form). */
export interface CallAIOptions {
  system: string
  prompt: string
  maxTokens?: number
  jsonMode?: boolean
  /** Optional file attachment — enables multimodal processing */
  fileUrl?: string
  fileType?: 'image' | 'pdf' | 'document'
}

/** Tracks which provider handled the request. */
export interface AIResponse {
  text: string
  provider: 'groq' | 'gemini'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`File fetch failed: ${res.status} ${url}`)
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream'
  console.log('[AI] Fetched file:', {
    mimeType,
    sizeKB: Math.round(buffer.byteLength / 1024),
  })
  return { base64, mimeType }
}

// ---------------------------------------------------------------------------
// Provider callers
// ---------------------------------------------------------------------------

/**
 * Gemini — handles TEXT, IMAGES, and PDFs natively.
 * PDFs are passed as inline base64 data; Gemini reads them directly.
 * This is the only provider that can reliably read scanned-image PDFs.
 */
async function callGeminiInternal(
  system: string,
  prompt: string,
  opts?: Pick<CallAIOptions, 'maxTokens' | 'jsonMode' | 'fileUrl' | 'fileType'>
): Promise<string> {
  if (!gemini) throw new Error('GEMINI_API_KEY not configured')

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system || undefined,
    generationConfig: {
      maxOutputTokens: opts?.maxTokens ?? 1000,
      ...(opts?.jsonMode ? { responseMimeType: 'application/json' as const } : {}),
    },
  })

  // Build the parts array — file first (if any), then the text prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  if (opts?.fileUrl && (opts.fileType === 'image' || opts.fileType === 'pdf')) {
    const { base64, mimeType } = await fetchFileAsBase64(opts.fileUrl)
    const fileMimeType = opts.fileType === 'pdf' ? 'application/pdf' : mimeType
    parts.push({ inlineData: { mimeType: fileMimeType, data: base64 } })
    console.log('[Gemini] File added as', fileMimeType)
  }

  parts.push({ text: prompt })

  const result = await model.generateContent(parts)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini')
  console.log('[AI] Gemini Flash success, preview:', text.slice(0, 200))
  return text
}

/**
 * Groq — handles TEXT and IMAGES (via llama-4-scout vision).
 * PDFs are NOT supported natively; for PDFs, use callGeminiInternal instead.
 */
async function callGroqInternal(
  system: string,
  prompt: string,
  opts?: Pick<CallAIOptions, 'maxTokens' | 'jsonMode' | 'fileUrl' | 'fileType'>
): Promise<string> {
  if (!groq) throw new Error('GROQ_API_KEY not configured')

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
  ]

  let useVision = false

  if (opts?.fileUrl && opts?.fileType === 'image') {
    // Vision path — Groq supports images via llama-4-scout
    const { base64, mimeType } = await fetchFileAsBase64(opts.fileUrl)
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ],
    })
    useVision = true
  } else {
    messages.push({ role: 'user', content: prompt })
  }

  const model = useVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL
  const response = await groq.chat.completions.create({
    model,
    max_tokens: opts?.maxTokens ?? 1000,
    ...(opts?.jsonMode && !useVision ? { response_format: { type: 'json_object' as const } } : {}),
    messages,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from Groq')
  console.log(`[AI] Groq success, model: ${model}`)
  console.log('[AI] Groq response preview:', content.slice(0, 200))
  return content
}

// ---------------------------------------------------------------------------
// callAI — main exported function (object-form signature preserved)
//
// Routing logic:
//   PDF  → Gemini (only provider with free native PDF support)
//   Image → Groq vision (primary) → Gemini (fallback on rate-limit)
//   Text  → Groq (primary) → Gemini (fallback on rate-limit)
// ---------------------------------------------------------------------------

export async function callAI({
  system,
  prompt,
  maxTokens = 1000,
  jsonMode = false,
  fileUrl,
  fileType,
}: CallAIOptions): Promise<string> {
  if (!groq && !gemini) {
    throw new Error(
      'No AI provider configured.\n' +
      '  GROQ_API_KEY   → free at console.groq.com\n' +
      '  GEMINI_API_KEY → free at aistudio.google.com'
    )
  }

  // ── PDF → Gemini (native PDF support; Groq cannot read PDFs) ─────────────
  if (fileType === 'pdf' && fileUrl) {
    if (!gemini) {
      throw new Error(
        'PDF reading requires GEMINI_API_KEY. ' +
        'Get your FREE key at aistudio.google.com — no card needed.'
      )
    }
    console.log('[AI] PDF detected → routing to Gemini')
    return callGeminiInternal(system, prompt, { maxTokens, jsonMode, fileUrl, fileType })
  }

  // ── Image → Groq vision first, Gemini as fallback ────────────────────────
  if (fileType === 'image' && fileUrl) {
    if (groq) {
      try {
        return await callGroqInternal(system, prompt, { maxTokens, jsonMode, fileUrl, fileType })
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.status === 503 ||
          err?.message?.includes('rate_limit')
        if (!isRateLimit) throw err
        console.warn('[AI] Groq Vision rate limited, trying Gemini')
      }
    }
    if (gemini) {
      return callGeminiInternal(system, prompt, { maxTokens, jsonMode, fileUrl, fileType })
    }
    throw new Error('No vision provider available. Set GROQ_API_KEY or GEMINI_API_KEY.')
  }

  // ── Text only → Groq primary, Gemini fallback ─────────────────────────────
  if (groq) {
    try {
      return await callGroqInternal(system, prompt, { maxTokens, jsonMode })
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.status === 503 ||
        err?.message?.includes('rate_limit')
      if (!isRateLimit) throw err
      console.warn('[AI] Groq rate limited, falling back to Gemini')
    }
  }

  if (gemini) {
    return callGeminiInternal(system, prompt, { maxTokens, jsonMode })
  }

  throw new Error('All AI providers failed. Check your API keys and rate limits.')
}

// ---------------------------------------------------------------------------
// Legacy multi-turn interface — delegates to callAI (unchanged)
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