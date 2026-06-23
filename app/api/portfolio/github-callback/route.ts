/**
 * GET /api/portfolio/github-callback
 *
 * GitHub redirects here after user approves OAuth.
 * 1. Exchange `code` for an access token via GitHub's token endpoint.
 * 2. Resolve the DB user from the `state` parameter.
 * 3. Encrypt the token (AES-256-GCM) and upsert into `connected_accounts`.
 * 4. Redirect user back to /portfolio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectedAccounts, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const portfolioUrl = new URL('/portfolio', req.url)
  const portfolioUrlWithError = (msg: string) => {
    portfolioUrl.searchParams.set('github_error', msg)
    return NextResponse.redirect(portfolioUrl)
  }

  // User denied OAuth
  if (errorParam) {
    return portfolioUrlWithError('github_denied')
  }

  if (!code || !state) {
    return portfolioUrlWithError('invalid_callback')
  }

  // Validate state format: <userId>.<nonce>
  const [dbUserId] = state.split('.')
  if (!dbUserId) {
    return portfolioUrlWithError('invalid_state')
  }

  // Confirm user exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, dbUserId))
    .limit(1)

  if (!user) {
    return portfolioUrlWithError('user_not_found')
  }

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return portfolioUrlWithError('oauth_not_configured')
  }

  // Exchange code → access token
  let accessToken: string
  let githubUserId: string | null = null
  let githubUsername: string | null = null

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/portfolio/github-callback`,
      }),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      error?: string
      error_description?: string
    }

    if (!tokenData.access_token) {
      console.error('[github-callback] Token exchange failed:', tokenData)
      return portfolioUrlWithError('token_exchange_failed')
    }

    accessToken = tokenData.access_token

    // Fetch GitHub user details to store the username
    const meRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'career-autopilot',
        Accept: 'application/vnd.github+json',
      },
    })

    if (meRes.ok) {
      const me = await meRes.json() as { id?: number; login?: string }
      githubUserId = me.id?.toString() ?? null
      githubUsername = me.login ?? null
    }
  } catch (err) {
    console.error('[github-callback] Unexpected error during token exchange:', err)
    return portfolioUrlWithError('server_error')
  }

  // Encrypt token before storage
  let encryptedToken: string
  try {
    encryptedToken = encrypt(accessToken)
  } catch (err) {
    console.error('[github-callback] Encryption failed:', err)
    return portfolioUrlWithError('encryption_failed')
  }

  // Upsert into connected_accounts
  try {
    const [existing] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, dbUserId),
          eq(connectedAccounts.platform, 'github')
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          accessToken: encryptedToken,
          platformUserId: githubUserId,
          platformUsername: githubUsername,
        })
        .where(eq(connectedAccounts.id, existing.id))
    } else {
      await db.insert(connectedAccounts).values({
        userId: dbUserId,
        platform: 'github',
        accessToken: encryptedToken,
        platformUserId: githubUserId,
        platformUsername: githubUsername,
      })
    }
  } catch (err) {
    console.error('[github-callback] DB upsert failed:', err)
    return portfolioUrlWithError('db_error')
  }

  // Success — redirect back to portfolio page
  portfolioUrl.searchParams.set('github_connected', '1')
  return NextResponse.redirect(portfolioUrl)
}
