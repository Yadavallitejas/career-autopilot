import { db } from '@/db'
import { connectedAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'

export async function getGitHubToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.platform, 'github')
      )
    )
    .limit(1)

  if (!row) return null

  try {
    return decrypt(row.accessToken)
  } catch {
    return null
  }
}
