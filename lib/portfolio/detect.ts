/**
 * Detects the project type of a GitHub repository by reading its file structure.
 * Detection priority: Dockerfile → package.json (framework) → requirements.txt →
 *   Gemfile → go.mod → index.html → unknown
 */

export type ProjectType =
  | "docker"
  | "nextjs"
  | "nuxt"
  | "react"
  | "vue"
  | "vite"
  | "svelte"
  | "node"
  | "python"
  | "ruby"
  | "go"
  | "static"
  | "unknown";

export type DeployTarget =
  | "github-pages"
  | "netlify"
  | "vercel"
  | "render"
  | "railway";

export interface DetectionResult {
  projectType: ProjectType;
  deployTarget: DeployTarget;
  buildCommand?: string;
  outputDir?: string;
  estimatedDeployMinutes: number;
}

export async function detectProjectType(
  repoContents: unknown[],
  packageJsonContent?: string
): Promise<DetectionResult> {
  // TODO: Implement detection logic per FR-027 / FR-028
  throw new Error("Not implemented");
}
