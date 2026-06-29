/**
 * POST /api/portfolio/resume-portfolio
 *
 * Generates a static HTML portfolio from the user's AI-structured resume data
 * + recent achievements and uploads it to the Supabase 'portfolios' bucket.
 *
 * Body: { template?: 'minimal' | 'developer' | 'creative' }
 * Returns: { url: string }
 *
 * Prerequisites:
 *   - Supabase Storage bucket 'portfolios' must exist and be set to Public.
 *     Dashboard → Storage → New bucket → name: portfolios, Public: ON
 */
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import {
  users,
  resumeVersions,
  achievements as achievementsTable,
  portfolioConfig,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import {
  generatePortfolioFromResume,
  type ResumePortfolioData,
  type PortfolioTemplate,
} from '@/lib/portfolio/generate-from-resume'
import type { StructuredResumeData } from '@/lib/resume/structurize'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let template: PortfolioTemplate = 'minimal'
  try {
    const body = await req.json()
    if (['minimal', 'developer', 'creative'].includes(body.template)) {
      template = body.template as PortfolioTemplate
    }
  } catch {
    // Default to minimal
  }

  // ── Fetch current resume ─────────────────────────────────────────────────
  const [currentResume] = await db
    .select()
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.userId, user.id),
        eq(resumeVersions.isCurrent, true)
      )
    )
    .limit(1)

  if (!currentResume) {
    return NextResponse.json(
      { error: 'No resume found. Please upload or build a resume first.' },
      { status: 400 }
    )
  }

  if (!currentResume.structuredData) {
    return NextResponse.json(
      {
        error:
          'Your resume data could not be structured for portfolio generation. ' +
          'Try re-uploading your resume, or build one from scratch instead.',
      },
      { status: 422 }
    )
  }

  // ── Fetch recent achievements ─────────────────────────────────────────────
  const achievementRows = await db
    .select({
      achievementType: achievementsTable.achievementType,
      resumeBullet: achievementsTable.resumeBullet,
      createdAt: achievementsTable.createdAt,
    })
    .from(achievementsTable)
    .where(
      and(
        eq(achievementsTable.userId, user.id),
        eq(achievementsTable.classifiedResumeWorthy, true)
      )
    )
    .orderBy(desc(achievementsTable.createdAt))
    .limit(8)

  // ── Map structuredData → ResumePortfolioData ──────────────────────────────
  const sd = currentResume.structuredData as StructuredResumeData
  const vp = user.voiceProfile as {
    fullName?: string
    jobTitle?: string
    industry?: string
  } | null

  const resumeData: ResumePortfolioData = {
    // Prefer voiceProfile overrides so the user's edited name/title wins
    fullName: vp?.fullName ?? sd.fullName ?? user.email.split('@')[0],
    jobTitle: vp?.jobTitle ?? undefined,
    email: sd.email ?? user.email,
    phone: sd.phone ?? undefined,
    location: sd.location ?? undefined,
    linkedinUrl: sd.linkedinUrl ?? undefined,
    githubUrl: sd.githubUrl ?? undefined,
    summary: sd.summary ?? undefined,
    skills: sd.skills ?? [],
    experience: (sd.experience ?? []).map((e) => ({
      company: e.company,
      role: e.title,       // structurize uses 'title'; ResumePortfolioData uses 'role'
      startDate: e.startDate,
      endDate: e.endDate ?? undefined,
      bullets: e.bullets,
    })),
    education: (sd.education ?? []).map((e) => ({
      institution: e.institution,
      degree: e.degree,
      year: e.graduationYear,
    })),
    // certifications in ResumePortfolioData is string[] — flatten to display name
    certifications: (sd.certifications ?? []).map((c) =>
      c.url ? `${c.name} — ${c.issuer} (${c.date})` : `${c.name} — ${c.issuer} (${c.date})`
    ),
    projects: (sd.projects ?? []).map((p) => ({
      name: p.name,
      description: p.description,
      url: p.url ?? undefined,
    })),
    achievements: achievementRows
      .filter((a) => a.resumeBullet)
      .map((a) => ({
        type: a.achievementType ?? 'other',
        bullet: a.resumeBullet!,
        date: new Date(a.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        }),
      })),
  }

  if (!resumeData.fullName) {
    return NextResponse.json(
      {
        error:
          'Could not determine your name from the resume. Please complete your profile or re-upload.',
      },
      { status: 400 }
    )
  }

  // ── Generate HTML and upload to Supabase ──────────────────────────────────
  let publicUrl: string
  try {
    publicUrl = await generatePortfolioFromResume(user.id, resumeData, template)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Portfolio Generation] Failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── Save to portfolio_config ───────────────────────────────────────────────
  try {
    await db
      .insert(portfolioConfig)
      .values({
        userId: user.id,
        deployUrl: publicUrl,
        deployPlatform: 'supabase',
        projectType: 'resume-portfolio',
        template,
        lastDeployed: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioConfig.userId,
        set: {
          deployUrl: publicUrl,
          deployPlatform: 'supabase',
          projectType: 'resume-portfolio',
          template,
          lastDeployed: new Date(),
        },
      })
  } catch (err) {
    console.error('[resume-portfolio] DB upsert failed (non-fatal):', err)
  }

  return NextResponse.json({ url: publicUrl })
}
