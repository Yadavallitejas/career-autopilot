// CRITICAL: @react-pdf/renderer needs full Node.js — edge runtime will crash.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users, resumeVersions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateResumePdf } from '@/lib/resume/builder'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation schema — mirrors ResumeData in builder.ts but with safe defaults
// ---------------------------------------------------------------------------

const ResumeDataSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  summary: z.string().optional(),
  experience: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        startDate: z.string(),
        endDate: z.string().optional(),
        bullets: z.array(z.string()),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        graduationYear: z.string(),
        gpa: z.string().optional(),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        date: z.string(),
        url: z.string().optional(),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        url: z.string().optional(),
        tech: z.array(z.string()),
      })
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  templateId: z.enum(['classic', 'modern']).default('classic'),
})

export type ValidatedResumeData = z.infer<typeof ResumeDataSchema>

// ---------------------------------------------------------------------------
// POST /api/resume/generate
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const { userId: clerkId } = auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse & validate body ────────────────────────────────────────────────
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = ResumeDataSchema.safeParse(rawBody)
    if (!validation.success) {
      const details = validation.error.issues.map(
        (i) => `${i.path.join('.') || 'root'}: ${i.message}`
      )
      console.error('[Resume Generate] Validation failed:', details)
      return NextResponse.json(
        { error: 'Missing or invalid fields', details },
        { status: 400 }
      )
    }

    const data = validation.data

    // ── Resolve DB user ──────────────────────────────────────────────────────
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Generate PDF ─────────────────────────────────────────────────────────
    const { fileUrl, rawText } = await generateResumePdf({
      userId: user.id,
      templateId: data.templateId,
      isPro: user.plan === 'pro' || user.plan === 'team',
      resumeData: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        location: data.location,
        linkedinUrl: data.linkedinUrl,
        githubUrl: data.githubUrl,
        summary: data.summary,
        experience: data.experience,
        education: data.education.map((e) => ({
          institution: e.institution,
          degree: e.degree,
          graduationYear: e.graduationYear,
          gpa: e.gpa,
        })),
        certifications: data.certifications,
        projects: data.projects,
        skills: data.skills,
      },
    })

    // ── Persist in DB (transaction) ──────────────────────────────────────────
    const [newVersion] = await db.transaction(async (tx) => {
      // Retire any existing current version
      await tx
        .update(resumeVersions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(resumeVersions.userId, user.id),
            eq(resumeVersions.isCurrent, true)
          )
        )

      const inserted = await tx
        .insert(resumeVersions)
        .values({
          userId: user.id,
          templateId: data.templateId,
          fileUrl,
          rawText,
          // The form data IS the structured data — no AI extraction needed
          structuredData: data,
          isCurrent: true,
          changesSummary: `Built from scratch (${data.templateId} template)`,
        })
        .returning()

      await tx
        .update(users)
        .set({ resumeSource: 'built', autoApplyResumeUpdates: true })
        .where(eq(users.id, user.id))

      return inserted
    })

    // ── Return signed URL ────────────────────────────────────────────────────
    const { getResumeSignedUrl } = await import('@/lib/storage/get-signed-url')
    const signedUrl = await getResumeSignedUrl(fileUrl)

    return NextResponse.json({ versionId: newVersion!.id, fileUrl: signedUrl })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during resume generation'
    console.error('[Resume Generate] Failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
