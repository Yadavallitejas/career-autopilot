import { callAi } from "./client";

export interface ResumeDiff {
  section: string;
  bullet: string;
  fullUpdatedSection?: string;
}

export async function generateResumeBullet(
  achievementText: string,
  existingResumeText: string
): Promise<ResumeDiff> {
  // TODO: Generate bullet point and identify the target section
  throw new Error("Not implemented");
}
