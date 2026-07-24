export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '@/db'
import {
  users,
  achievements as achievementsTable,
  resumeVersions,
  coachConversations,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// POST /api/coach/chat
// Streams Gemini Flash responses with full user context.
// Body: { message: string; conversationId?: string; history?: {role, content}[] }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Resolve DB user ───────────────────────────────────────────────────────
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── Plan gate ─────────────────────────────────────────────────────────────
  if (user.plan === 'free') {
    return NextResponse.json(
      { error: 'Career Coach is a Pro feature. Upgrade to access your AI coach.' },
      { status: 403 }
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let message: string
  let conversationId: string | undefined
  let history: { role: 'user' | 'assistant'; content: string }[] = []

  try {
    const body = await req.json()
    message = body.message
    conversationId = body.conversationId
    history = body.history ?? []
    if (!message?.trim()) throw new Error('Empty message')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Fetch user context (parallel) ─────────────────────────────────────────
  const [recentAchievements, currentResumeRows, voiceProfileRow] =
    await Promise.all([
      db
        .select({
          rawInput: achievementsTable.rawInput,
          achievementType: achievementsTable.achievementType,
          resumeBullet: achievementsTable.resumeBullet,
          status: achievementsTable.status,
          createdAt: achievementsTable.createdAt,
        })
        .from(achievementsTable)
        .where(eq(achievementsTable.userId, user.id))
        .orderBy(desc(achievementsTable.createdAt))
        .limit(15),

      db
        .select({ rawText: resumeVersions.rawText })
        .from(resumeVersions)
        .where(
          and(
            eq(resumeVersions.userId, user.id),
            eq(resumeVersions.isCurrent, true)
          )
        )
        .limit(1),

      db
        .select({ voiceProfile: users.voiceProfile })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1),
    ])

  const resumeText = currentResumeRows[0]?.rawText ?? ''
  const vp = voiceProfileRow[0]?.voiceProfile as {
    fullName?: string
    jobTitle?: string
    industry?: string
    motivation?: string
  } | null

  // ── Build rich system prompt ──────────────────────────────────────────────
  const systemPrompt = `You are a personalized AI career coach for ${vp?.fullName ?? user.email}.${
    vp?.jobTitle ? ` They work as a ${vp.jobTitle}` : ''
  }${vp?.industry ? ` in the ${vp.industry} industry` : ''}.${
    vp?.motivation
      ? ` Their primary career goal is: ${
          {
            job_hunting: 'landing a new role',
            brand_building: 'building their personal brand on LinkedIn',
            track_achievements: 'tracking and showcasing their achievements',
            portfolio: 'deploying a portfolio of projects',
          }[vp.motivation] ?? vp.motivation
        }.`
      : ''
  }

== RECENT ACHIEVEMENTS (last ${recentAchievements.length}) ==
${
  recentAchievements.length > 0
    ? recentAchievements
        .map(
          (a) =>
            `• [${a.achievementType ?? 'other'}] ${a.rawInput}${
              a.resumeBullet ? `\n  → Resume bullet: "${a.resumeBullet}"` : ''
            } (${new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`
        )
        .join('\n')
    : 'No achievements logged yet.'
}

== CURRENT RESUME (first 1200 chars) ==
${resumeText ? resumeText.slice(0, 1200) : 'No resume uploaded yet.'}

== YOUR ROLE ==
Give specific, actionable career advice grounded in their real achievements and resume.
Reference concrete details when relevant — don't give generic advice.
Topics: resume optimisation, LinkedIn strategy, interview prep, career progression, skill gaps, networking, personal branding.
Tone: encouraging but honest. Concise: 2–4 short paragraphs max unless they explicitly ask for more.
Format using markdown — bold key terms, use bullet lists for action items, use headers only when truly needed.
If they haven't uploaded a resume or logged achievements yet, gently encourage them to do so first for the best experience.`

  // ── Guard: need Gemini API key ────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'AI not configured — please contact support.' },
      { status: 503 }
    )
  }

  // ── Build Gemini chat history ──────────────────────────────────────────────
  // Clip to last 20 turns to stay within context window.
  // Gemini uses 'model' for assistant turns (not 'assistant').
  const clippedHistory = history.slice(-20)

  const geminiHistory = clippedHistory.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }))

  // ── Persist new user message to DB (fire-and-forget) ─────────────────────
  const updatedMessages = [
    ...clippedHistory,
    { role: 'user' as const, content: message },
  ]
  void persistConversation(user.id, conversationId, updatedMessages)

  // ── Stream Gemini response ─────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 900 },
  })

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = ''
      const encoder = new TextEncoder()

      try {
        const chat = model.startChat({ history: geminiHistory })
        const result = await chat.sendMessageStream(message)

        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          if (chunkText) {
            assistantText += chunkText
            controller.enqueue(encoder.encode(chunkText))
          }
        }

        controller.close()

        // Persist full assistant response after streaming completes
        void persistConversation(user.id, conversationId, [
          ...updatedMessages,
          { role: 'assistant' as const, content: assistantText },
        ])
      } catch (err) {
        console.error('[coach/chat] Gemini stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Helper — upsert conversation in DB
// ---------------------------------------------------------------------------

async function persistConversation(
  userId: string,
  conversationId: string | undefined,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  try {
    if (conversationId) {
      await db
        .update(coachConversations)
        .set({ messages: messages as never, updatedAt: new Date() })
        .where(
          and(
            eq(coachConversations.id, conversationId),
            eq(coachConversations.userId, userId)
          )
        )
    } else {
      await db.insert(coachConversations).values({
        userId,
        messages: messages as never,
      })
    }
  } catch (err) {
    // Non-fatal — don't fail the stream over a DB write
    console.error('[coach/chat] Failed to persist conversation:', err)
  }
}
