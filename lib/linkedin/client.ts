/**
 * LinkedIn API client for direct post publishing (Pro feature).
 * Uses OAuth 2.0 access tokens stored encrypted in the DB.
 */

export interface LinkedInPostResult {
  id: string;
  url: string;
}

export async function publishPost(
  accessToken: string,
  content: string,
  mediaUrls?: string[]
): Promise<LinkedInPostResult> {
  // TODO: Post to LinkedIn Share API v2
  throw new Error("Not implemented");
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  // TODO: Exchange refresh token for new access token
  throw new Error("Not implemented");
}

export async function isTokenValid(
  accessToken: string,
  expiresAt: Date
): Promise<boolean> {
  // Token needs refresh if < 1 hour remaining
  const oneHour = 60 * 60 * 1000;
  return expiresAt.getTime() - Date.now() > oneHour;
}
