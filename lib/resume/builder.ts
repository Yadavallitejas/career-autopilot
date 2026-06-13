import React from "react";
import type { ReactElement } from "react";
import ReactPDF from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { supabase } from "@/lib/storage/client";
import { ClassicTemplate } from "./templates/classic";
import { ModernTemplate } from "./templates/modern";

// Convenience alias for the document element type expected by renderToBuffer
type PDFDocElement = ReactElement<DocumentProps>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  /** New field */
  graduationYear?: string;
  /** Legacy alias — kept for backward compat */
  graduationDate?: string;
  /** Legacy alias */
  field?: string;
  gpa?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

export interface Project {
  name: string;
  description: string;
  url?: string;
  /** New field */
  tech?: string[];
  /** Legacy alias — kept for backward compat */
  technologies?: string[];
}

export interface ResumeData {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  summary?: string;
  experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  skills: string[];
}

// ---------------------------------------------------------------------------
// generateResumePdf — primary public export
// ---------------------------------------------------------------------------

export async function generateResumePdf({
  userId,
  templateId,
  isPro,
  resumeData,
}: {
  userId: string;
  templateId: "classic" | "modern";
  isPro: boolean;
  resumeData: ResumeData;
}): Promise<{ fileUrl: string; rawText: string }> {
  // 1. Select template component — cast to PDFDocElement to satisfy renderToBuffer
  const element: PDFDocElement =
    templateId === "modern"
      ? (React.createElement(ModernTemplate, { data: resumeData, isPro }) as PDFDocElement)
      : (React.createElement(ClassicTemplate, { data: resumeData, isPro }) as PDFDocElement);

  // 2. Render to PDF buffer
  const buffer = await ReactPDF.renderToBuffer(element);

  // 3. Generate unique storage path
  const filename = `resumes/${userId}/${Date.now()}.pdf`;

  // 4. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(filename, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `[generateResumePdf] Storage upload failed: ${uploadError.message}`
    );
  }

  // 5. Get public URL
  const { data: urlData } = supabase.storage
    .from("resumes")
    .getPublicUrl(filename);

  // 6. Build rawText for AI context
  const rawText = buildRawText(resumeData);

  return { fileUrl: urlData.publicUrl, rawText };
}

// ---------------------------------------------------------------------------
// buildResumeFromData — simple buffer-only helper (used by QStash pipeline)
// ---------------------------------------------------------------------------

export async function buildResumeFromData(data: ResumeData): Promise<Buffer> {
  const element = React.createElement(ClassicTemplate, {
    data,
    isPro: true, // no watermark when building from structured data
  }) as PDFDocElement;
  return ReactPDF.renderToBuffer(element);
}

// ---------------------------------------------------------------------------
// addBulletToResume — inserts a new bullet into the correct section
// ---------------------------------------------------------------------------

/**
 * Maps a resumeSection string (from AI classification) to the correct
 * ResumeData field and inserts the bullet. Returns updated ResumeData.
 *
 * Section routing:
 *   "Certifications" → adds a new Certification entry (name = bullet text)
 *   "Projects"       → adds a new Project entry (name + description = bullet)
 *   "Open Source"    → same as Projects
 *   "Education"      → adds a bullet as a note (appended to first edu entry degree)
 *   anything else    → "Experience" (appends bullet to the most recent role)
 */
export async function addBulletToResume(
  resumeData: ResumeData,
  section: string,
  bullet: string
): Promise<ResumeData> {
  const data = structuredClone(resumeData);
  const sectionNorm = section.toLowerCase().trim();

  if (sectionNorm === "certifications") {
    data.certifications = [
      {
        name: bullet,
        issuer: "",
        date: new Date().getFullYear().toString(),
      },
      ...data.certifications,
    ];
  } else if (
    sectionNorm === "projects" ||
    sectionNorm === "open source" ||
    sectionNorm === "awards"
  ) {
    data.projects = [
      {
        name: bullet.length > 60 ? bullet.slice(0, 57) + "…" : bullet,
        description: bullet,
        tech: [],
      },
      ...data.projects,
    ];
  } else {
    // Default: append to most recent experience role
    if (data.experience.length > 0) {
      data.experience = data.experience.map((exp, idx) => {
        if (idx === 0) {
          return { ...exp, bullets: [...exp.bullets, bullet] };
        }
        return exp;
      });
    } else {
      // No experience entries — create a placeholder
      data.experience = [
        {
          company: "",
          title: section,
          startDate: new Date().getFullYear().toString(),
          bullets: [bullet],
        },
      ];
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// buildRawText — converts ResumeData to plain-text for AI context
// ---------------------------------------------------------------------------

function buildRawText(data: ResumeData): string {
  const lines: string[] = [];

  lines.push(data.fullName);
  lines.push(
    [data.email, data.phone, data.location, data.linkedinUrl, data.githubUrl]
      .filter(Boolean)
      .join(" | ")
  );

  if (data.summary) {
    lines.push("", "SUMMARY", data.summary);
  }

  if (data.experience.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const exp of data.experience) {
      lines.push(
        `${exp.title} at ${exp.company} (${exp.startDate} – ${exp.endDate ?? "Present"})`
      );
      for (const b of exp.bullets) {
        lines.push(`  • ${b}`);
      }
    }
  }

  if (data.education.length > 0) {
    lines.push("", "EDUCATION");
    for (const edu of data.education) {
      const year = edu.graduationYear ?? edu.graduationDate ?? "";
      lines.push(
        `${edu.degree}${edu.field ? `, ${edu.field}` : ""} — ${edu.institution} (${year})${edu.gpa ? ` GPA: ${edu.gpa}` : ""}`
      );
    }
  }

  if (data.certifications.length > 0) {
    lines.push("", "CERTIFICATIONS");
    for (const cert of data.certifications) {
      lines.push(`${cert.name} — ${cert.issuer}${cert.date ? ` (${cert.date})` : ""}`);
    }
  }

  if (data.projects.length > 0) {
    lines.push("", "PROJECTS");
    for (const proj of data.projects) {
      const tech = proj.tech ?? proj.technologies ?? [];
      lines.push(
        `${proj.name}: ${proj.description}${tech.length ? ` [${tech.join(", ")}]` : ""}`
      );
    }
  }

  if (data.skills.length > 0) {
    lines.push("", "SKILLS");
    lines.push(data.skills.join(", "));
  }

  return lines.join("\n");
}
