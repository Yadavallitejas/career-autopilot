/**
 * Detects the project type of a GitHub repository by reading its file
 * structure and (optionally) the decoded content of package.json.
 *
 * Detection priority order:
 *   1. Dockerfile                 → docker  (deploy: render)
 *   2. package.json deps/scripts  → nextjs | nuxt | svelte | vue | react | vite | node
 *   3. requirements.txt / pyproject.toml → python (deploy: render)
 *   4. Gemfile                    → ruby   (deploy: render)
 *   5. go.mod                     → go     (deploy: render)
 *   6. index.html (no framework)  → static (deploy: github-pages)
 *   7. fallback                   → unknown (deploy: github-pages)
 */

import type { GithubFile } from "@/lib/github/client";

// ---------------------------------------------------------------------------
// Exported types (defined here — callers should import from this module)
// ---------------------------------------------------------------------------

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
  /** Rough estimate of how long a first deploy will take (minutes) */
  estimatedDeployMinutes: number;
}

// ---------------------------------------------------------------------------
// PackageJson — minimal shape we care about
// ---------------------------------------------------------------------------

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Rule tables
// ---------------------------------------------------------------------------

/**
 * Each entry: [depPattern, projectType, deployTarget, buildCmd, outputDir, deployMins]
 *
 * Checked in order — first match wins.
 * `depPattern` is matched against all dependency keys (deps + devDeps).
 */
const PACKAGE_JSON_RULES: Array<{
  /** Exact dependency name or substring to match */
  dep: string;
  projectType: ProjectType;
  deployTarget: DeployTarget;
  buildCommand: string;
  outputDir: string;
  estimatedDeployMinutes: number;
}> = [
  // Next.js — must come before generic "react" check
  {
    dep: "next",
    projectType: "nextjs",
    deployTarget: "vercel",
    buildCommand: "next build",
    outputDir: ".next",
    estimatedDeployMinutes: 4,
  },
  // Nuxt — must come before "vue"
  {
    dep: "nuxt",
    projectType: "nuxt",
    deployTarget: "netlify",
    buildCommand: "nuxt build",
    outputDir: ".output",
    estimatedDeployMinutes: 4,
  },
  // SvelteKit / Svelte — check before generic vite
  {
    dep: "@sveltejs/kit",
    projectType: "svelte",
    deployTarget: "netlify",
    buildCommand: "npm run build",
    outputDir: "build",
    estimatedDeployMinutes: 3,
  },
  {
    dep: "svelte",
    projectType: "svelte",
    deployTarget: "netlify",
    buildCommand: "npm run build",
    outputDir: "build",
    estimatedDeployMinutes: 3,
  },
  // Vue
  {
    dep: "vue",
    projectType: "vue",
    deployTarget: "netlify",
    buildCommand: "npm run build",
    outputDir: "dist",
    estimatedDeployMinutes: 3,
  },
  // Vite (generic, no framework-specific dep detected above)
  {
    dep: "vite",
    projectType: "vite",
    deployTarget: "netlify",
    buildCommand: "vite build",
    outputDir: "dist",
    estimatedDeployMinutes: 2,
  },
  // React CRA / plain React
  {
    dep: "react",
    projectType: "react",
    deployTarget: "netlify",
    buildCommand: "npm run build",
    outputDir: "build",
    estimatedDeployMinutes: 3,
  },
  // Express / plain Node
  {
    dep: "express",
    projectType: "node",
    deployTarget: "railway",
    buildCommand: "npm run build",
    outputDir: "dist",
    estimatedDeployMinutes: 3,
  },
  {
    dep: "fastify",
    projectType: "node",
    deployTarget: "railway",
    buildCommand: "npm run build",
    outputDir: "dist",
    estimatedDeployMinutes: 3,
  },
  {
    dep: "koa",
    projectType: "node",
    deployTarget: "railway",
    buildCommand: "npm start",
    outputDir: "dist",
    estimatedDeployMinutes: 3,
  },
];

// Scripts that override the deploy target even when a dep matched
const VERCEL_SCRIPT_HINTS = ["vercel", "now"];
const NETLIFY_SCRIPT_HINTS = ["netlify"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileNames(contents: GithubFile[]): Set<string> {
  return new Set(contents.map((f) => f.path.toLowerCase()));
}

/**
 * Safely parse a JSON string. Returns null on failure.
 */
function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Returns all dependency names across deps, devDeps and peerDeps.
 */
function allDeps(pkg: PackageJson): string[] {
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
}

/**
 * Check whether any script value contains one of the hint strings.
 */
function scriptHasHint(scripts: Record<string, string>, hints: string[]): boolean {
  const values = Object.values(scripts).join(" ").toLowerCase();
  return hints.some((h) => values.includes(h));
}

// ---------------------------------------------------------------------------
// detectProjectType — main export
// ---------------------------------------------------------------------------

/**
 * Detects the project type from a repository's root-level file listing and
 * (optionally) the decoded content of `package.json`.
 *
 * @param repoContents        Array of GithubFile entries from getRepoContents()
 * @param packageJsonContent  Decoded text content of package.json (optional)
 */
export async function detectProjectType(
  repoContents: GithubFile[],
  packageJsonContent?: string
): Promise<DetectionResult> {
  const names = fileNames(repoContents);

  // ── 1. Dockerfile ─────────────────────────────────────────────────────────
  if (names.has("dockerfile")) {
    return {
      projectType: "docker",
      deployTarget: "render",
      buildCommand: "docker build -t app .",
      outputDir: undefined,
      estimatedDeployMinutes: 6,
    };
  }

  // ── 2. package.json ────────────────────────────────────────────────────────
  if (names.has("package.json") && packageJsonContent) {
    const pkg = parseJson<PackageJson>(packageJsonContent);

    if (pkg) {
      const deps = allDeps(pkg);
      const scripts = pkg.scripts ?? {};

      for (const rule of PACKAGE_JSON_RULES) {
        // Match if any dep name exactly equals, or starts with, the rule dep
        // e.g. "next" matches "next", "nuxt" matches "nuxt3"
        const matched = deps.some(
          (d) => d === rule.dep || d.startsWith(rule.dep + "@") || d === `@${rule.dep}`
        );

        if (matched) {
          let deployTarget = rule.deployTarget;

          // Override deploy target if scripts hint at a specific platform
          if (scriptHasHint(scripts, VERCEL_SCRIPT_HINTS)) {
            deployTarget = "vercel";
          } else if (scriptHasHint(scripts, NETLIFY_SCRIPT_HINTS)) {
            deployTarget = "netlify";
          }

          // Derive build command from scripts if available
          const buildCommand =
            scripts["build"] ?? scripts["compile"] ?? rule.buildCommand;

          return {
            projectType: rule.projectType,
            deployTarget,
            buildCommand,
            outputDir: rule.outputDir,
            estimatedDeployMinutes: rule.estimatedDeployMinutes,
          };
        }
      }

      // package.json found but no recognised framework dep — plain Node
      return {
        projectType: "node",
        deployTarget: "railway",
        buildCommand: scripts["build"] ?? scripts["start"] ?? "npm start",
        outputDir: scripts["build"] ? "dist" : undefined,
        estimatedDeployMinutes: 3,
      };
    }
  }

  // package.json present but no content provided — optimistic node detection
  if (names.has("package.json")) {
    return {
      projectType: "node",
      deployTarget: "railway",
      buildCommand: "npm start",
      outputDir: undefined,
      estimatedDeployMinutes: 3,
    };
  }

  // ── 3. Python ─────────────────────────────────────────────────────────────
  if (names.has("requirements.txt") || names.has("pyproject.toml") || names.has("setup.py")) {
    return {
      projectType: "python",
      deployTarget: "render",
      buildCommand: "pip install -r requirements.txt",
      outputDir: undefined,
      estimatedDeployMinutes: 5,
    };
  }

  // ── 4. Ruby ───────────────────────────────────────────────────────────────
  if (names.has("gemfile")) {
    return {
      projectType: "ruby",
      deployTarget: "render",
      buildCommand: "bundle install",
      outputDir: undefined,
      estimatedDeployMinutes: 5,
    };
  }

  // ── 5. Go ─────────────────────────────────────────────────────────────────
  if (names.has("go.mod")) {
    return {
      projectType: "go",
      deployTarget: "render",
      buildCommand: "go build -o app .",
      outputDir: undefined,
      estimatedDeployMinutes: 4,
    };
  }

  // ── 6. Static HTML ────────────────────────────────────────────────────────
  if (names.has("index.html")) {
    return {
      projectType: "static",
      deployTarget: "github-pages",
      buildCommand: undefined,
      outputDir: ".",
      estimatedDeployMinutes: 1,
    };
  }

  // ── 7. Unknown ────────────────────────────────────────────────────────────
  return {
    projectType: "unknown",
    deployTarget: "github-pages",
    buildCommand: undefined,
    outputDir: undefined,
    estimatedDeployMinutes: 2,
  };
}
