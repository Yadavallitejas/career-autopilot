import { callAI } from './client'

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ExtractedCertificate {
  certificationName: string | null
  issuingOrganization: string | null
  completionDate: string | null   // YYYY-MM-DD or null
  score: string | null            // e.g. "890/1000" or "94%"
  skills: string[]                // topics/technologies extracted from the doc
  courseDescription: string | null
  credentialId: string | null
  candidateName: string | null
  rawText: string                 // full visible text, used for AI context downstream
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `
You are a document analyzer specialized in reading certificates,
diplomas, course completions, and professional credentials.

Extract all information from the provided document or image and
return ONLY a valid JSON object with no markdown, no preamble.

If a field is not visible or not present, set it to null.
For skills, extract all topics, technologies, or subject areas
mentioned — even from the course description or certificate body.

Return this exact structure:
{
  "certificationName": "full official name of the certification or course",
  "issuingOrganization": "the organization that issued it (e.g. IBM, Google, Coursera, AWS)",
  "completionDate": "date in YYYY-MM-DD format if visible, else null",
  "score": "score or grade if shown (e.g. 94%, 890/1000, Distinction)",
  "skills": ["skill1", "skill2", "skill3"],
  "courseDescription": "brief description of what was covered",
  "credentialId": "credential ID or certificate number if shown",
  "candidateName": "name of the person the certificate was issued to",
  "rawText": "all visible text from the document concatenated"
}
`.trim()

// ---------------------------------------------------------------------------
// Minimal safe fallback — returned when parsing fails
// ---------------------------------------------------------------------------

function fallback(rawText: string): ExtractedCertificate {
  return {
    certificationName: null,
    issuingOrganization: null,
    completionDate: null,
    score: null,
    skills: [],
    courseDescription: null,
    credentialId: null,
    candidateName: null,
    rawText,
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Sends a file (image, PDF, or Word doc) to the AI pipeline and extracts
 * structured certificate metadata from it.
 *
 * The call flows through the standard provider chain:
 *   Groq (vision/text) → Anthropic → Gemini
 *
 * @param fileUrl  Public URL of the uploaded file (Supabase Storage)
 * @param fileType Category of the file — drives which extraction path is used
 */
export async function extractCertificateContent(
  fileUrl: string,
  fileType: 'image' | 'pdf' | 'document'
): Promise<ExtractedCertificate> {
  let text: string

  try {
    text = await callAI({
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: 'Extract all information from this document.',
      maxTokens: 1500,   // certificates can have substantial text
      jsonMode: true,    // ask Groq to enforce JSON output directly
      fileUrl,
      fileType,
    })
  } catch (err) {
    console.error('[extractCertificateContent] AI call failed:', err)
    return fallback('')
  }

  try {
    // Strip any accidental markdown fences that non-JSON-mode providers may add
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as ExtractedCertificate

    // Ensure skills is always an array, even if the model returns null/string
    if (!Array.isArray(parsed.skills)) {
      parsed.skills = []
    }

    return parsed
  } catch {
    console.warn('[extractCertificateContent] JSON parse failed — returning raw text fallback')
    return fallback(text)
  }
}
