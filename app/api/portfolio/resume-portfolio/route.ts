/**
 * POST /api/portfolio/resume-portfolio
 *
 * Generates a static HTML portfolio from the user's resume data + recent
 * achievements and uploads it to Supabase Storage.
 *
 * Body: { template?: 'minimal' | 'developer' | 'creative' }
 * Returns: { url: string }
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

  // Fetch resume + achievements in parallel
  const [resumeRows, achievementRows] = await Promise.all([
    db
      .select()
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
      .limit(8),
  ])

  const vp = user.voiceProfile as {
    fullName?: string
    jobTitle?: string
    industry?: string
  } | null

  // Parse raw resume text into structured data if available
  const rawText = resumeRows[0]?.rawText ?? ''
  const resumeData = parseResumeText(rawText, vp, user.email)

  // Add achievements
  resumeData.achievements = achievementRows
    .filter((a) => a.resumeBullet)
    .map((a) => ({
      type: a.achievementType ?? 'other',
      bullet: a.resumeBullet!,
      date: new Date(a.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      }),
    }))

  if (!resumeData.fullName) {
    return NextResponse.json(
      {
        error:
          'Please complete your profile or upload a resume before generating a portfolio.',
      },
      { status: 400 }
    )
  }

  // Generate HTML and upload to Supabase
  let publicUrl: string
  try {
    publicUrl = await generatePortfolioFromResume(user.id, resumeData, template)
  } catch (err) {
    console.error('[resume-portfolio] Generation failed:', err)
    return NextResponse.json(
      { error: 'Portfolio generation failed. Please try again.' },
      { status: 500 }
    )
  }

  // Save to portfolio_config so the configured view shows it
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

// ---------------------------------------------------------------------------
// Simple heuristic parser — extracts structure from raw resume text
// Falls back gracefully when the text is unstructured
// ---------------------------------------------------------------------------

function parseResumeText(
  rawText: string,
  vp: { fullName?: string; jobTitle?: string; industry?: string } | null,
  email: string
): ResumePortfolioData {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Extract skills — look for a "Skills" section or comma-separated lists
  const skills: string[] = []
  let inSkills = false
  for (const line of lines) {
    if (/^skills?/i.test(line)) { inSkills = true; continue }
    if (inSkills) {
      if (/^(experience|education|work|projects|summary|certif)/i.test(line)) {
        inSkills = false
        continue
      }
      // Split by commas or bullets
      const parts = line.split(/[,•|·]+/).map((s) => s.trim()).filter(Boolean)
      skills.push(...parts.slice(0, 20))
    }
  }

  // Extract email from text if not from voiceProfile
  const emailMatch = rawText.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
  const parsedEmail = emailMatch?.[0] ?? email

  // LinkedIn / GitHub
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/[\w-]+/i)
  const githubMatch = rawText.match(/github\.com\/[\w-]+/i)

  return {
    fullName: vp?.fullName ?? lines[0] ?? email.split('@')[0],
    jobTitle: vp?.jobTitle ?? undefined,
    email: parsedEmail,
    linkedinUrl: linkedinMatch ? `https://${linkedinMatch[0]}` : undefined,
    githubUrl: githubMatch ? `https://${githubMatch[0]}` : undefined,
    summary: undefined, // Could enhance with AI in future
    skills: [...new Set(skills)].slice(0, 25),
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    achievements: [],
  }
}
