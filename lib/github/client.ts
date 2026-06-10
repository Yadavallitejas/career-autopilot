/**
 * GitHub API client wrapper.
 * Uses the user's stored OAuth token (decrypted) for authenticated requests.
 */

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
}

export async function getUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  // TODO: Fetch repos via GitHub REST API
  throw new Error("Not implemented");
}

export async function getRepoContents(
  accessToken: string,
  owner: string,
  repo: string,
  path = ""
): Promise<unknown[]> {
  // TODO: Fetch repo file tree for project type detection
  throw new Error("Not implemented");
}

export async function createRepo(
  accessToken: string,
  name: string,
  description?: string
): Promise<GitHubRepo> {
  // TODO: Create a new GitHub repository
  throw new Error("Not implemented");
}
