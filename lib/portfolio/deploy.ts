import type { DetectionResult } from "./detect";

export interface DeployResult {
  url: string;
  platform: string;
  deployedAt: Date;
}

export async function deployPortfolio(
  repoFullName: string,
  detection: DetectionResult,
  accessToken: string
): Promise<DeployResult> {
  // TODO: Route to the correct platform deployer based on detection.deployTarget
  throw new Error("Not implemented");
}
