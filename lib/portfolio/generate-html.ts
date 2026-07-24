/**
 * AI-powered portfolio HTML generator.
 *
 * Works from whatever data is available — structured resume, raw text, or
 * just achievements. Always produces real HTML (never a placeholder).
 *
 * Used by the QStash portfolio_deploy job BEFORE pushing to GitHub Pages.
 */

import { callAI } from '@/lib/ai/client'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface PortfolioUserData {
  /** Display name — falls back to email prefix if not set */
  name: string
  email: string
}

export interface PortfolioResumeData {
  /** Professional summary / bio */
  summary?: string
  jobTitle?: string
  skills?: string[]
  experience?: {
    role: string
    company: string
    start?: string
    end?: string | null
    bullets?: string[]
  }[]
  education?: {
    institution: string
    degree?: string
    year?: string
  }[]
  certifications?: {
    name: string
    issuer?: string
    date?: string
  }[]
  projects?: {
    name: string
    description?: string
    url?: string
  }[]
  /** Raw resume text — used when structured fields are not available */
  rawText?: string | null
}

export interface PortfolioAchievement {
  rawInput: string
  resumeBullet?: string | null
  achievementType?: string | null
}

export type PortfolioTemplate = 'minimal' | 'developer' | 'creative'

// ---------------------------------------------------------------------------
// Template visual specs (passed to AI so it applies the right design system)
// ---------------------------------------------------------------------------

const TEMPLATE_SPECS: Record<PortfolioTemplate, { description: string; css: string }> = {
  minimal: {
    description: 'Clean, ATS-friendly, single-column, white background, Inter font, emerald accent (#10b981)',
    css: `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #09090b; line-height: 1.6; font-size: 15px; }
      .container { max-width: 760px; margin: 0 auto; padding: 48px 24px; }
      a { color: #10b981; text-decoration: none; }
      a:hover { text-decoration: underline; }
      h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
      h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #52525b; border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; margin: 32px 0 16px; }
      .chip { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 3px 10px; font-size: 13px; display: inline-block; margin: 3px; }
      .skills { margin-bottom: 8px; }
      .entry { margin-bottom: 20px; }
      .entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
      .role { font-weight: 600; }
      .date { font-size: 12px; color: #71717a; white-space: nowrap; }
      ul { padding-left: 16px; }
      ul li { margin-bottom: 4px; font-size: 14px; color: #52525b; }
      footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #71717a; }
    `,
  },
  developer: {
    description: 'Dark terminal aesthetic, two-column capable, JetBrains Mono font, dark background (#0d1117), green accent (#34d399)',
    css: `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0d1117; color: #c9d1d9; line-height: 1.6; font-size: 14px; }
      .container { max-width: 900px; margin: 0 auto; padding: 48px 24px; }
      a { color: #34d399; text-decoration: none; }
      a:hover { text-decoration: underline; }
      h1 { font-size: 1.8rem; font-weight: 700; color: #f0f6fc; letter-spacing: -0.01em; }
      h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #34d399; border-bottom: 1px solid #21262d; padding-bottom: 8px; margin: 32px 0 16px; }
      .chip { background: #161b22; border: 1px solid #30363d; border-radius: 4px; padding: 2px 8px; font-size: 12px; display: inline-block; margin: 3px; color: #8b949e; }
      .skills { margin-bottom: 8px; }
      .entry { margin-bottom: 20px; }
      .entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
      .role { font-weight: 600; color: #f0f6fc; }
      .date { font-size: 12px; color: #8b949e; white-space: nowrap; }
      ul { padding-left: 16px; }
      ul li { margin-bottom: 4px; font-size: 13px; color: #8b949e; }
      footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #21262d; font-size: 12px; color: #8b949e; }
    `,
  },
  creative: {
    description: 'Bold gradient hero, purple/indigo palette, Inter font, vibrant, full-bleed sections',
    css: `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', system-ui, sans-serif; background: #fafafa; color: #1e1b4b; line-height: 1.6; }
      .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 64px 24px; text-align: center; }
      .hero h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; }
      .hero .subtitle { font-size: 1.1rem; margin-top: 8px; opacity: 0.9; }
      .container { max-width: 780px; margin: 0 auto; padding: 48px 24px; }
      a { color: #7c3aed; text-decoration: none; }
      a:hover { text-decoration: underline; }
      h2 { font-size: 1.25rem; font-weight: 700; color: #4c1d95; border-left: 4px solid #7c3aed; padding-left: 12px; margin: 36px 0 16px; }
      .chip { background: #ede9fe; border-radius: 999px; padding: 4px 14px; font-size: 13px; display: inline-block; margin: 4px; color: #5b21b6; font-weight: 500; }
      .skills { margin-bottom: 8px; }
      .entry { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
      .entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
      .role { font-weight: 700; color: #3730a3; }
      .date { font-size: 12px; color: #7c3aed; white-space: nowrap; font-weight: 500; }
      ul { padding-left: 16px; }
      ul li { margin-bottom: 4px; font-size: 14px; color: #374151; }
      footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    `,
  },
}

// ---------------------------------------------------------------------------
// Data summary builder — converts whatever we have into a rich text brief
// ---------------------------------------------------------------------------

function buildDataSummary(
  user: PortfolioUserData,
  resumeData: PortfolioResumeData | null,
  achievements: PortfolioAchievement[]
): string {
  const lines: string[] = [
    `Name: ${user.name}`,
    `Email: ${user.email}`,
  ]

  if (resumeData?.jobTitle) lines.push(`Job Title: ${resumeData.jobTitle}`)
  if (resumeData?.summary) lines.push(`Summary: ${resumeData.summary}`)

  if (resumeData?.skills?.length) {
    lines.push(`Skills: ${resumeData.skills.join(', ')}`)
  }

  if (resumeData?.experience?.length) {
    lines.push('\nExperience:')
    for (const e of resumeData.experience) {
      lines.push(`  - ${e.role} at ${e.company} (${e.start ?? '?'} – ${e.end ?? 'Present'})`)
      if (e.bullets?.length) {
        for (const b of e.bullets.slice(0, 3)) {
          lines.push(`    • ${b}`)
        }
      }
    }
  }

  if (resumeData?.education?.length) {
    lines.push('\nEducation:')
    for (const ed of resumeData.education) {
      lines.push(`  - ${ed.institution}${ed.degree ? ` — ${ed.degree}` : ''}${ed.year ? ` (${ed.year})` : ''}`)
    }
  }

  if (resumeData?.projects?.length) {
    lines.push('\nProjects:')
    for (const p of resumeData.projects) {
      lines.push(`  - ${p.name}${p.description ? `: ${p.description}` : ''}${p.url ? ` (${p.url})` : ''}`)
    }
  }

  if (resumeData?.certifications?.length) {
    lines.push('\nCertifications:')
    for (const c of resumeData.certifications) {
      const cert = typeof c === 'string'
        ? c
        : `${c.name}${c.issuer ? ` from ${c.issuer}` : ''}${c.date ? ` (${c.date})` : ''}`
      lines.push(`  - ${cert}`)
    }
  }

  // If no structured data at all, fall back to raw resume text (first 1500 chars)
  if (
    !resumeData?.experience?.length &&
    !resumeData?.skills?.length &&
    !resumeData?.projects?.length &&
    resumeData?.rawText
  ) {
    lines.push('\nResume Text (extract key info from this):')
    lines.push(resumeData.rawText.slice(0, 1500))
  }

  if (achievements.length) {
    lines.push('\nRecent Achievements:')
    for (const a of achievements.slice(0, 5)) {
      const bullet = a.resumeBullet || a.rawInput
      lines.push(`  - ${bullet}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Generates a complete, production-ready HTML portfolio using AI.
 *
 * - Always returns real HTML — never a placeholder.
 * - Works from structured data, raw text, or just achievements.
 * - The AI receives the full design spec for the chosen template.
 */
export async function generatePortfolioHTML(
  user: PortfolioUserData,
  resumeData: PortfolioResumeData | null,
  achievements: PortfolioAchievement[],
  template: PortfolioTemplate = 'minimal'
): Promise<string> {
  const spec = TEMPLATE_SPECS[template]
  const dataSummary = buildDataSummary(user, resumeData, achievements)

  const systemPrompt = `You are a portfolio website generator. Generate a complete, beautiful, single-file HTML portfolio website.

CRITICAL RULES:
- Return ONLY the complete HTML document. No markdown fences, no explanation, no preamble.
- Start EXACTLY with: <!DOCTYPE html>
- The file must be fully self-contained (no external JS except Google Fonts via CDN)
- Use the ACTUAL person data provided — never use placeholder names or "Lorem Ipsum"
- Skip sections gracefully if data is missing — don't invent fake data

TEMPLATE: ${template}
DESIGN DESCRIPTION: ${spec.description}

REQUIRED SECTIONS (only include if data exists):
1. Header/Hero — name, job title, email link
2. About/Summary — professional bio
3. Skills — as tags/chips
4. Experience — roles, companies, dates, bullet points
5. Projects — name, description, link if available
6. Certifications — name, issuer, date
7. Recent Achievements — from the achievements list
8. Footer — "Built with Career Autopilot"

REQUIRED CSS to embed in <style>:
${spec.css}

ADDITIONAL CSS REQUIREMENTS:
- Responsive: works on mobile (max-width: 600px media query)
- Smooth scroll: html { scroll-behavior: smooth; }
- Google Fonts import in <head> matching the template font
- Navigation bar with anchor links to each section (sticky, minimal)`

  const userPrompt = `Generate a portfolio for:\n\n${dataSummary}`

  console.log('[generatePortfolioHTML] Calling AI for template:', template, '| data summary length:', dataSummary.length)

  const text = await callAI({
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
  })

  // Strip any markdown fences the model may have added despite instructions
  let html = text.trim()
  if (html.startsWith('```html')) html = html.slice(7)
  if (html.startsWith('```')) html = html.slice(3)
  if (html.endsWith('```')) html = html.slice(0, -3)
  html = html.trim()

  // Validate it's actually HTML
  if (!html.toLowerCase().startsWith('<!doctype')) {
    // Try to find DOCTYPE inside the response (model sometimes adds preamble)
    const idx = html.toLowerCase().indexOf('<!doctype')
    if (idx > 0) {
      console.warn('[generatePortfolioHTML] Trimmed preamble before DOCTYPE')
      html = html.slice(idx)
    } else {
      throw new Error(
        `[generatePortfolioHTML] AI did not return valid HTML. ` +
        `Preview: ${html.slice(0, 200)}`
      )
    }
  }

  console.log('[generatePortfolioHTML] HTML generated:', html.length, 'chars')
  return html
}
