/**
 * Resume builder — compiles structured resume data into a renderable document.
 */

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
  skills: string[];
  certifications: Certification[];
  projects: Project[];
}

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
  field?: string;
  graduationDate?: string;
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
  technologies: string[];
  url?: string;
}

export async function buildResumeFromData(data: ResumeData): Promise<Buffer> {
  // TODO: Render resume using @react-pdf/renderer and return PDF buffer
  throw new Error("Not implemented");
}

export async function addBulletToResume(
  resumeData: ResumeData,
  section: string,
  bullet: string
): Promise<ResumeData> {
  // TODO: Insert bullet into the correct section and return updated data
  throw new Error("Not implemented");
}
