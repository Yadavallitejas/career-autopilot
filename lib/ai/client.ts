import Anthropic from '@anthropic-ai/sdk'
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

// Anthropic: FALLBACK — higher quality, costs money
const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null

// Gemini: THIRD FALLBACK — free, 1500 req/day
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

const GROQ_TEXT_MODEL   = 'llama-3.3-70b-versatile'
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const ANTHROPIC_MODEL   = 'claude-sonnet-4-20250514'
const GEMINI_MODEL      = 'gemini-2.5-flash'

// ---------------------------------------------------------------------------
// Shared types (existing callAI object-form interface — unchanged)
// ---------------------------------------------------------------------------

export type AiMessage = { role: 'user' | 'assistant'; content: string }

/** Core options used by all existing callers (object-form). */
export interface CallAIOptions {
  system: string
  prompt: string
  maxTokens?: number
  jsonMode?: boolean
  /** Optional file attachment — enables multimodal processing */
  fileUrl?: string
  fileType?: 'image' | 'pdf' | 'document'
}

/** Returned by the new positional-arg callAI overload — tracks which provider responded. */
export interface AIResponse {
  text: string
  provider: 'groq' | 'anthropic' | 'gemini'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`File fetch failed: ${res.status} ${url}`)
  const buffer = await res.arrayBuffer()
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: res.headers.get('content-type') ?? 'application/octet-stream',
  }
}

/**
 * Extract plain text from a PDF via pdf-parse — pure Node.js, works in Vercel serverless.
 * Replaces the previous pdfjs-dist implementation which required browser canvas APIs.
 */
async function extractTextFromPDF(fileUrl: string): Promise<string> {
  // Fetch the PDF as a buffer
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Use pdf-parse — pure Node.js, works in Vercel serverless
  // pdf-parse may resolve as CJS (function) or ESM — handle both
  const pdfMod = await import('pdf-parse')
  const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
    (pdfMod as any).default ?? (pdfMod as any)
  const data = await pdfParse(buffer)

  if (!data.text || data.text.trim().length < 10) {
    throw new Error('PDF appears to be image-only or empty. No extractable text found.')
  }

  console.log('[PDF] Extracted', data.text.length, 'chars from', data.numpages, 'pages')
  return data.text
}

// ---------------------------------------------------------------------------
// Provider callers
// ---------------------------------------------------------------------------

async function callGroq(
  system: string,
  prompt: string,
  opts?: Pick<CallAIOptions, 'maxTokens' | 'jsonMode' | 'fileUrl' | 'fileType'>
): Promise<string> {
  if (!groq) throw new Error('Groq not configured')

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
  ]

  let useVision = false

  if (opts?.fileUrl && opts?.fileType) {
    if (opts.fileType === 'image') {
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
    } else if (opts.fileType === 'pdf') {
      // Groq has no native PDF support — extract text first then inject into message
      try {
        const pdfText = await extractTextFromPDF(opts.fileUrl)
        const enrichedMessage =
          `[DOCUMENT CONTENT - extracted from uploaded PDF]\n` +
          `${pdfText}\n\n` +
          `[END OF DOCUMENT]\n\n` +
          `[USER'S NOTE]\n${prompt}`
        messages.push({ role: 'user', content: enrichedMessage })
        console.log('[Groq] PDF text injected into message, chars:', pdfText.length)
      } catch (pdfErr) {
        // If text extraction fails (image-only PDF), tell the user clearly
        console.error('[Groq] PDF extraction failed:', pdfErr)
        messages.push({
          role: 'user',
          content: prompt +
            '\n\n[Note: The uploaded PDF could not be read - ' +
            'it may be a scanned image. Please describe the ' +
            'certificate details in text above.]',
        })
      }
    } else {
      // document (Word etc.) — model receives the text prompt only
      messages.push({ role: 'user', content: prompt })
    }
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

async function callAnthropic(
  system: string,
  prompt: string,
  opts?: Pick<CallAIOptions, 'maxTokens' | 'fileUrl' | 'fileType'>
): Promise<string> {
  if (!anthropic) throw new Error('Anthropic not configured')

  const userContent: Anthropic.MessageParam['content'] = []

  if (opts?.fileUrl && opts?.fileType) {
    const { base64, mimeType } = await fetchFileAsBase64(opts.fileUrl)

    if (opts.fileType === 'image') {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType as any, data: base64 },
      })
    } else if (opts.fileType === 'pdf') {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as any)
    }
    // document (Word): no binary block — the AI sees the text prompt only
  }

  userContent.push({ type: 'text', text: prompt })

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts?.maxTokens ?? 1000,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
  console.log('[AI] Anthropic success, tokens:', response.usage.output_tokens)
  return block.text
}

async function callGemini(
  system: string,
  prompt: string,
  opts?: Pick<CallAIOptions, 'maxTokens' | 'jsonMode'>
): Promise<string> {
  if (!gemini) throw new Error('Gemini not configured')

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: opts?.maxTokens ?? 1000,
      ...(opts?.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  })

  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt
  const result = await model.generateContent(fullPrompt)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini')
  console.log('[AI] Gemini 2.5 Flash success')
  console.log('[AI] Gemini response preview:', text.slice(0, 200))
  return text
}

// ---------------------------------------------------------------------------
// callAI — main exported function (existing object-form signature preserved)
// Fallback chain: Groq → Anthropic → Gemini
// ---------------------------------------------------------------------------

export async function callAI({
  system,
  prompt,
  maxTokens = 1000,
  jsonMode = false,
  fileUrl,
  fileType,
}: CallAIOptions): Promise<string> {
  if (!groq && !anthropic && !gemini) {
    throw new Error(
      'No AI provider available. Set GROQ_API_KEY in .env.local (free at console.groq.com).'
    )
  }

  // ── 1. Groq (primary — free, fast) ──────────────────────────────────────
  if (groq) {
    try {
      return await callGroq(system, prompt, { maxTokens, jsonMode, fileUrl, fileType })
    } catch (err: any) {
      const isRetryable =
        err?.status === 429 || err?.status === 503 || err?.message?.includes('rate_limit')
      if (isRetryable) {
        console.warn('[AI] Groq rate limited, falling back to Anthropic')
      } else {
        console.error('[AI] Groq error:', err?.message)
        // Fall through — don't let one bad call block the whole pipeline
      }
    }
  }

  // ── 2. Anthropic (fallback — better quality) ─────────────────────────────
  if (anthropic) {
    try {
      return await callAnthropic(system, prompt, { maxTokens, fileUrl, fileType })
    } catch (err: any) {
      const isRetryable =
        err instanceof Anthropic.APIError && [429, 402, 529].includes(err.status ?? 0)
      if (isRetryable) {
        console.warn('[AI] Anthropic rate limited, falling back to Gemini')
      } else {
        console.error('[AI] Anthropic error:', err?.message)
      }
    }
  }

  // ── 3. Gemini (third fallback — free, 1500 req/day) ──────────────────────
  if (gemini) {
    try {
      return await callGemini(system, prompt, { maxTokens, jsonMode })
    } catch (err: any) {
      console.error('[AI] Gemini also failed:', err?.message)
    }
  }

  throw new Error('All AI providers failed. Check your API keys and rate limits.')
}

// ---------------------------------------------------------------------------
// Backward-compat exports (unchanged — existing callers must not break)
// ---------------------------------------------------------------------------

export function getAnthropicClient() {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
  return anthropic
}

// Legacy multi-turn interface — delegates to callAI
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