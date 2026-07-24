/**
 * POST /api/portfolio/resume-portfolio
 *
 * Generates a portfolio HTML page from the user's resume data + achievements
 * and uploads it to Supabase Storage ('career-autopilot-portfolios' bucket).
 *
 * Uses generatePortfolioHTML (AI-powered) as the primary path — works even
 * without structuredData (raw uploaded resumes, no wizard). Falls back to
 * the static template builder if AI fails.
 *
 * Body: { template?: 'minimal' | 'developer' | 'creative' }
 * Returns: { url: string }
 *
 * Prerequisites:
 *   Supabase Storage bucket 'career-autopilot-portfolios' must exist + be Public.
 *   Dashboard → Storage → New bucket → name: career-autopilot-portfolios, Public: ON
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
import { uploadFile } from '@/lib/storage/client'
import type { PortfolioTemplate, ResumePortfolioData } from '@/lib/portfolio/generate-from-resume'

const PORTFOLIO_BUCKET = 'career-autopilot-portfolios'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Parse template ───────────────────────────────────────────────────────────
  let template: PortfolioTemplate = 'minimal'
  try {
    const body = await req.json()
    if (['minimal', 'developer', 'creative'].includes(body?.template)) {
      template = body.template as PortfolioTemplate
    }
  } catch {
    // Default to minimal
  }

  // ── Fetch resume + achievements in parallel ──────────────────────────────────
  const [resumeRows, achievementRows] = await Promise.all([
    db
      .select({
        structuredData: resumeVersions.structuredData,
        rawText: resumeVersions.rawText,
      })
      .from(resumeVersions)
      .where(
        and(
          eq(resumeVersions.userId, user.id),
          eq(resumeVersions.isCurrent, true)
        )
      )
      .limit(1),
    db
      .select({
        rawInput: achievementsTable.rawInput,
        resumeBullet: achievementsTable.resumeBullet,
        achievementType: achievementsTable.achievementType,
      })
      .from(achievementsTable)
      .where(
        and(
          eq(achievementsTable.userId, user.id),
          eq(achievementsTable.status, 'complete')
        )
      )
      .orderBy(desc(achievementsTable.createdAt))
      .limit(8),
  ])

  const resumeRow = resumeRows[0]

  // ── Build display name ───────────────────────────────────────────────────────
  const vp = user.voiceProfile as { fullName?: string; jobTitle?: string } | null
  const displayName = vp?.fullName ?? user.email.split('@')[0]

  // ── Generate HTML (AI primary, static fallback) ──────────────────────────────
  let html = ''

  try {
    const { generatePortfolioHTML } = await import('@/lib/portfolio/generate-html')

    const resumeDataForGen = {
      ...(resumeRow?.structuredData as Record<string, unknown> | null ?? {}),
      rawText: resumeRow?.rawText ?? null,
    }

    html = await generatePortfolioHTML(
      { name: displayName, email: user.email },
      resumeDataForGen,
      achievementRows,
      template
    )

    console.log(`[resume-portfolio] AI generated ${template} HTML (${html.length} chars)`)
  } catch (aiErr) {
    console.warn('[resume-portfolio] AI generation failed, trying static builder:', aiErr)

    // Static fallback — only works when structuredData is available
    if (resumeRow?.structuredData) {
      try {
        const {
          buildMinimalHtml,
          buildDeveloperHtml,
          buildCreativeHtml,
        } = await import('@/lib/portfolio/generate-from-resume')

        const sd = resumeRow.structuredData as {
          fullName?: string; email?: string; phone?: string; location?: string;
          linkedinUrl?: string; githubUrl?: string; summary?: string;
          skills?: string[];
          experience?: { company: string; title: string; startDate?: string; endDate?: string; bullets?: string[] }[];
          education?: { institution: string; degree?: string; graduationYear?: string }[];
          certifications?: { name: string; issuer: string; date: string; url?: string }[];
          projects?: { name: string; description?: string; url?: string }[];
        }

        const resumeData: ResumePortfolioData = {
          fullName: vp?.fullName ?? sd.fullName ?? displayName,
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
            role: e.title,
            startDate: e.startDate,
            endDate: e.endDate ?? undefined,
            bullets: e.bullets,
          })),
          education: (sd.education ?? []).map((e) => ({
            institution: e.institution,
            degree: e.degree,
            year: e.graduationYear,
          })),
          certifications: (sd.certifications ?? []).map(
            (c) => `${c.name} — ${c.issuer} (${c.date})`
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
            })),
        }

        html =
          template === 'developer'
            ? buildDeveloperHtml(resumeData)
            : template === 'creative'
            ? buildCreativeHtml(resumeData)
            : buildMinimalHtml(resumeData)

        console.log(`[resume-portfolio] Static fallback built ${template} HTML (${html.length} chars)`)
      } catch (staticErr) {
        console.error('[resume-portfolio] Static builder also failed:', staticErr)
      }
    } else {
      console.error('[resume-portfolio] AI failed and no structuredData for static fallback')
    }
  }

  if (!html) {
    return NextResponse.json(
      {
        error:
          'Portfolio generation failed. Please make sure you have a resume uploaded or achievements added, then try again.',
      },
      { status: 500 }
    )
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────────
  const storagePath = `${user.id}/index.html`
  let publicUrl: string

  try {
    publicUrl = await uploadFile(
      Buffer.from(html, 'utf-8'),
      storagePath,
      'text/html',
      PORTFOLIO_BUCKET
    )
  } catch (uploadErr) {
    const message = uploadErr instanceof Error ? uploadErr.message : 'Upload failed'
    console.error('[resume-portfolio] Storage upload failed:', uploadErr)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── Upsert portfolio_config ───────────────────────────────────────────────────
  try {
    await db
      .insert(portfolioConfig)
      .values({
        userId: user.id,
        deployUrl: publicUrl,
        deployPlatform: 'supabase',
        deployStatus: 'live',
        projectType: 'resume-portfolio',
        template,
        lastDeployed: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioConfig.userId,
        set: {
          deployUrl: publicUrl,
          deployPlatform: 'supabase',
          deployStatus: 'live',
          projectType: 'resume-portfolio',
          template,
          lastDeployed: new Date(),
          deployError: null,
        },
      })
  } catch (dbErr) {
    // Non-fatal — URL is already valid
    console.error('[resume-portfolio] DB upsert failed (non-fatal):', dbErr)
  }

  return NextResponse.json({ url: publicUrl })
}
