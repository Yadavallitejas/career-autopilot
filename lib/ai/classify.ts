import { callAi } from "./client";

export type AchievementType =
  | "certification"
  | "project"
  | "award"
  | "job_change"
  | "education"
  | "open_source"
  | "publication"
  | "other";

export interface ClassificationResult {
  type: AchievementType;
  resumeScore: number;
  portfolioScore: number;
  resumeReasoning: string;
  portfolioReasoning: string;
}

export async function classifyAchievement(
  achievementText: string,
  resumeContext?: string,
  portfolioContext?: string
): Promise<ClassificationResult> {
  // TODO: Call AI with CLASSIFY_SYSTEM_PROMPT, parse JSON response
  throw new Error("Not implemented");
}
