import type { DetectionResult } from "./detect";
import { deployToGitHubPages } from "./platforms/github-pages";

export interface DeployResult {
  url: string;
  platform: string;
  deployedAt: Date;
}

/**
 * Routes to the correct platform deployer based on the detection result.
 * Currently only github-pages is fully implemented.
 * Other platforms (Vercel, Netlify, Render, Railway) throw — the QStash
 * handler catches the error and marks deployStatus='failed'.
 *
 * @param htmlContent - Complete HTML string for index.html. Required for
 *   github-pages; ignored by other platforms.
 */
export async function deployPortfolio(
  repoOwner: string,
  repoName: string,
  detection: DetectionResult,
  accessToken: string,
  htmlContent: string
): Promise<DeployResult> {
  switch (detection.deployTarget) {
    case "github-pages": {
      const result = await deployToGitHubPages(repoOwner, repoName, accessToken, htmlContent);
      return {
        url: result.url,
        platform: result.platform,
        deployedAt: result.deployedAt,
      };
    }

    // Future platforms — fail loudly so the error surfaces clearly
    case "vercel":
      throw new Error(
        "Vercel deployment is not yet available. Please deploy to Vercel manually."
      );
    case "netlify":
      throw new Error(
        "Netlify deployment is not yet available. Please deploy to Netlify manually."
      );
    case "render":
      throw new Error(
        "Render deployment is not yet available. Please deploy to Render manually."
      );
    case "railway":
      throw new Error(
        "Railway deployment is not yet available. Please deploy to Railway manually."
      );
    default:
      throw new Error(`Unknown deploy target: ${detection.deployTarget}`);
  }
}
