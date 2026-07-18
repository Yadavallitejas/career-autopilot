import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ExtractedCertificate } from "@/lib/ai/extract-certificate";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// buildEnrichedInput — combines user text + AI-extracted certificate fields
// into a single, structured prompt block used by all downstream AI calls.
// ---------------------------------------------------------------------------

export function buildEnrichedInput(
  userText: string,
  cert: ExtractedCertificate | null
): string {
  if (!cert) return userText;

  const parts: string[] = [];

  // Only include the user's description when it's real content — skip the
  // auto-generated "Uploaded: filename" placeholder set by the form.
  if (userText && userText.trim() && !userText.startsWith("Uploaded:")) {
    parts.push(`User's description: ${userText}`);
  }

  if (cert.certificationName)  parts.push(`Certification: ${cert.certificationName}`);
  if (cert.issuingOrganization) parts.push(`Issued by: ${cert.issuingOrganization}`);
  if (cert.completionDate)     parts.push(`Completed: ${cert.completionDate}`);
  if (cert.score)              parts.push(`Score / Grade: ${cert.score}`);
  if (cert.skills.length > 0) parts.push(`Skills covered: ${cert.skills.join(", ")}`);
  if (cert.courseDescription)  parts.push(`About this credential: ${cert.courseDescription}`);
  if (cert.credentialId)       parts.push(`Credential ID: ${cert.credentialId}`);
  if (cert.candidateName)      parts.push(`Recipient: ${cert.candidateName}`);

  // Always fall back to at least the raw text so the AI has something
  return parts.length > 0 ? parts.join("\n") : userText;
}

