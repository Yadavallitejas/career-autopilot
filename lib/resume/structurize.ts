import { callAI } from '@/lib/ai/client'

// ---------------------------------------------------------------------------
// Structured resume data shape — matches what the AI is asked to extract.
// Field names mirror ResumePortfolioData where possible so the portfolio
// generator can consume this directly after a small mapping step.
// ---------------------------------------------------------------------------

export interface StructuredResumeData {
  fullName: string
  email: string
  phone: string | null
  location: string | null
  linkedinUrl: string | null
  githubUrl: string | null
  summary: string | null
  experience: {
    company: string
    title: string        // mapped → role in ResumePortfolioData
    startDate: string
    endDate: string | null
    bullets: string[]
  }[]
  education: {
    institution: string
    degree: string
    graduationYear: string
    gpa: string | null
  }[]
  certifications: {
    name: string
    issuer: string
    date: string
    url: string | null
  }[]
  projects: {
    name: string
    description: string
    url: string | null
    tech: string[]
  }[]
  skills: string[]
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calls the AI to extract structured fields from raw resume text.
 * Returns a typed StructuredResumeData object.
 *
 * Throws if the AI response cannot be parsed as valid JSON.
 */
export async function structurizeResumeText(
  rawText: string
): Promise<StructuredResumeData> {
  const prompt = `Extract structured data from this resume text. Return JSON exactly matching:
{
  "fullName": string,
  "email": string,
  "phone": string|null,
  "location": string|null,
  "linkedinUrl": string|null,
  "githubUrl": string|null,
  "summary": string|null,
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string|null, "bullets": string[] }],
  "education": [{ "institution": string, "degree": string, "graduationYear": string, "gpa": string|null }],
  "certifications": [{ "name": string, "issuer": string, "date": string, "url": string|null }],
  "projects": [{ "name": string, "description": string, "url": string|null, "tech": string[] }],
  "skills": string[]
}
If a field cannot be found, use null or an empty array. Do not fabricate information not present in the text.

Resume text:
${rawText.slice(0, 6000)}`

  const raw = await callAI({
    system:
      'You extract structured resume data. Output ONLY valid JSON, no markdown, no commentary.',
    prompt,
    maxTokens: 2000,
    jsonMode: true,
  })

  try {
    // Strip optional markdown code fences the model may have included
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
    return JSON.parse(cleaned) as StructuredResumeData
  } catch (error) {
    console.error('[Structurize] JSON parse failed:', error, '\nRaw output:', raw)
    throw new Error('Could not extract structured data from this resume')
  }
}
