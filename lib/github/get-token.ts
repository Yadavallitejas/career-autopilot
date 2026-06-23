import { clerkClient } from '@clerk/nextjs/server'

/**
 * Retrieves a GitHub OAuth token from Clerk's token store.
 * Returns null if the user has not connected GitHub or the token is unavailable.
 */
export async function getGitHubToken(clerkId: string): Promise<string | null> {
  try {
    const client = await clerkClient()
    const { data } = await client.users.getUserOauthAccessToken(
      clerkId,
      'oauth_github'
    )
    return data[0]?.token ?? null
  } catch {
    return null
  }
}
