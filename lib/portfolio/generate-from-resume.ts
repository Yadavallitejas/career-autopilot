/**
 * Generates a static HTML portfolio page from resume data and uploads
 * it to Supabase Storage (public bucket: 'portfolios').
 *
 * Returns a publicly accessible URL like:
 *   https://<supabase-url>/storage/v1/object/public/portfolios/<userId>/index.html
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumePortfolioData {
  fullName: string
  jobTitle?: string
  email?: string
  phone?: string
  location?: string
  linkedinUrl?: string
  githubUrl?: string
  websiteUrl?: string
  summary?: string
  skills?: string[]
  experience?: {
    company: string
    role: string
    startDate?: string
    endDate?: string
    bullets?: string[]
  }[]
  education?: {
    institution: string
    degree?: string
    year?: string
  }[]
  certifications?: string[]
  projects?: {
    name: string
    description?: string
    url?: string
  }[]
  achievements?: {
    type: string
    bullet: string
    date?: string
  }[]
}

export type PortfolioTemplate = 'minimal' | 'developer' | 'creative'

// ---------------------------------------------------------------------------
// Supabase client (server-side, service role)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

export function buildMinimalHtml(data: ResumePortfolioData): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const links = [
    data.email && `<a href="mailto:${esc(data.email)}">${esc(data.email)}</a>`,
    data.phone && `<span>${esc(data.phone)}</span>`,
    data.location && `<span>${esc(data.location)}</span>`,
    data.linkedinUrl &&
      `<a href="${esc(data.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>`,
    data.githubUrl &&
      `<a href="${esc(data.githubUrl)}" target="_blank" rel="noopener">GitHub</a>`,
    data.websiteUrl &&
      `<a href="${esc(data.websiteUrl)}" target="_blank" rel="noopener">Website</a>`,
  ]
    .filter(Boolean)
    .join('<span class="sep">·</span>')

  const skills =
    data.skills && data.skills.length > 0
      ? `<section>
      <h2>Skills</h2>
      <div class="skills">${data.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
    </section>`
      : ''

  const experience =
    data.experience && data.experience.length > 0
      ? `<section>
      <h2>Experience</h2>
      ${data.experience
        .map(
          (e) => `<div class="entry">
        <div class="entry-header">
          <div><strong>${esc(e.role)}</strong> — ${esc(e.company)}</div>
          ${e.startDate ? `<span class="date">${esc(e.startDate)}${e.endDate ? ` – ${esc(e.endDate)}` : ' – Present'}</span>` : ''}
        </div>
        ${e.bullets && e.bullets.length > 0 ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </div>`
        )
        .join('')}
    </section>`
      : ''

  const education =
    data.education && data.education.length > 0
      ? `<section>
      <h2>Education</h2>
      ${data.education
        .map(
          (e) => `<div class="entry">
        <div class="entry-header">
          <div><strong>${esc(e.institution)}</strong>${e.degree ? ` — ${esc(e.degree)}` : ''}</div>
          ${e.year ? `<span class="date">${esc(e.year)}</span>` : ''}
        </div>
      </div>`
        )
        .join('')}
    </section>`
      : ''

  const projects =
    data.projects && data.projects.length > 0
      ? `<section>
      <h2>Projects</h2>
      ${data.projects
        .map(
          (p) => `<div class="entry">
        <div class="entry-header">
          <div><strong>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</strong></div>
        </div>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      </div>`
        )
        .join('')}
    </section>`
      : ''

  const achievements =
    data.achievements && data.achievements.length > 0
      ? `<section>
      <h2>Recent Achievements</h2>
      <ul>${data.achievements.map((a) => `<li>${esc(a.bullet)}${a.date ? ` <span class="date">(${esc(a.date)})</span>` : ''}</li>`).join('')}</ul>
    </section>`
      : ''

  const certs =
    data.certifications && data.certifications.length > 0
      ? `<section>
      <h2>Certifications</h2>
      <ul>${data.certifications.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </section>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.fullName)} — Portfolio</title>
  <meta name="description" content="${data.jobTitle ? `${esc(data.fullName)} — ${esc(data.jobTitle)}` : esc(data.fullName)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --fg: #09090b;
      --fg-muted: #52525b;
      --border: #e4e4e7;
      --accent: #10b981;
      --bg: #ffffff;
      --chip-bg: #f4f4f5;
    }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      font-size: 15px;
    }
    .container { max-width: 760px; margin: 0 auto; padding: 48px 24px; }
    header { margin-bottom: 40px; }
    header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
    header .subtitle { font-size: 1rem; color: var(--accent); font-weight: 600; margin-top: 4px; }
    .links { display: flex; flex-wrap: wrap; gap: 6px 0; margin-top: 12px; font-size: 13px; color: var(--fg-muted); align-items: center; }
    .links a { color: var(--fg-muted); text-decoration: none; }
    .links a:hover { color: var(--accent); }
    .sep { margin: 0 8px; opacity: 0.4; }
    .summary { color: var(--fg-muted); margin-bottom: 40px; max-width: 620px; line-height: 1.7; }
    section { margin-bottom: 36px; }
    section h2 {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fg-muted);
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .skills { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      background: var(--chip-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 13px;
      font-weight: 500;
    }
    .entry { margin-bottom: 20px; }
    .entry:last-child { margin-bottom: 0; }
    .entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 8px; }
    .entry-header strong { font-weight: 600; }
    .date { font-size: 12px; color: var(--fg-muted); white-space: nowrap; }
    ul { list-style: none; padding: 0; }
    ul li { padding-left: 16px; position: relative; margin-bottom: 6px; font-size: 14px; color: var(--fg-muted); }
    ul li::before { content: '–'; position: absolute; left: 0; color: var(--accent); }
    p { font-size: 14px; color: var(--fg-muted); }
    footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--fg-muted); }
    footer a { color: var(--accent); text-decoration: none; }
    @media (max-width: 600px) {
      .container { padding: 32px 16px; }
      header h1 { font-size: 1.5rem; }
      .entry-header { flex-direction: column; gap: 2px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${esc(data.fullName)}</h1>
      ${data.jobTitle ? `<p class="subtitle">${esc(data.jobTitle)}</p>` : ''}
      <div class="links">${links}</div>
    </header>

    ${data.summary ? `<p class="summary">${esc(data.summary)}</p>` : ''}

    ${skills}
    ${experience}
    ${projects}
    ${achievements}
    ${education}
    ${certs}

    <footer>
      Built with <a href="https://career-autopilot.com" target="_blank" rel="noopener">Career Autopilot</a>
      &nbsp;·&nbsp; Last updated ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
    </footer>
  </div>
</body>
</html>`
}

export function buildDeveloperHtml(data: ResumePortfolioData): string {
  // Same structure as minimal but with dark theme + terminal aesthetic
  const minimal = buildMinimalHtml(data)
  return minimal.replace(
    ':root {',
    `:root {
      --fg: #e4e4e7;
      --fg-muted: #a1a1aa;
      --border: #27272a;
      --accent: #34d399;
      --bg: #09090b;
      --chip-bg: #18181b;`
  )
}

export function buildCreativeHtml(data: ResumePortfolioData): string {
  // Gradient accent header variation
  const base = buildMinimalHtml(data)
  return base.replace(
    'header h1 { font-size: 2rem',
    'header h1 { background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2rem'
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generatePortfolioFromResume(
  userId: string,
  resumeData: ResumePortfolioData,
  template: PortfolioTemplate = 'minimal'
): Promise<string> {
  // 1. Generate HTML
  let html: string
  if (template === 'developer') {
    html = buildDeveloperHtml(resumeData)
  } else if (template === 'creative') {
    html = buildCreativeHtml(resumeData)
  } else {
    html = buildMinimalHtml(resumeData)
  }

  // 2. Upload to Supabase Storage
  const supabase = getSupabase()
  const path = `${userId}/index.html`
  const bucket = 'portfolios'

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, Buffer.from(html, 'utf-8'), {
      contentType: 'text/html',
      upsert: true,
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  // 3. Return public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return urlData.publicUrl
}
