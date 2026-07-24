/**
 * GET /api/portfolio/github-callback
 *
 * GitHub redirects here after user approves OAuth.
 * 1. Parse and HMAC-verify the `state` parameter — rejects any forged state.
 * 2. If a Clerk session is present, cross-check that the authenticated userId
 *    matches the userId embedded in state (belt-and-suspenders).
 * 3. Exchange `code` for an access token via GitHub's token endpoint.
 * 4. Encrypt the token (AES-256-GCM) and upsert into `connected_accounts`.
 * 5. Redirect user back to /portfolio.
 *
 * Security model:
 *   state = "<dbUserId>.<nonce>.<hmac>"
 *   hmac  = HMAC-SHA256(ENCRYPTION_KEY, "<dbUserId>.<nonce>")
 *
 *   An attacker cannot forge a valid state for a different userId without
 *   knowing ENCRYPTION_KEY (which never leaves the server).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { connectedAccounts, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'
import { verifyOAuthState } from '@/lib/github/oauth-state'

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

  // ── 1. Parse and verify the HMAC-signed state ──────────────────────────────
  //
  // Expected format: <dbUserId>.<nonce>.<hmac>
  // The HMAC covers "<dbUserId>.<nonce>" and was generated in github-auth
  // using ENCRYPTION_KEY. Any tampering invalidates the HMAC.
  const parts = state.split('.')
  if (parts.length < 3) {
    console.warn('[github-callback] State has wrong number of segments')
    return portfolioUrlWithError('invalid_state')
  }

  // Last segment is the HMAC; everything before it is the signed payload
  const receivedHmac = parts[parts.length - 1]
  const signedPayload = parts.slice(0, -1).join('.')
  const dbUserId = parts[0]

  if (!dbUserId || !receivedHmac || !signedPayload) {
    return portfolioUrlWithError('invalid_state')
  }

  if (!verifyOAuthState(signedPayload, receivedHmac)) {
    // State was forged or tampered — hard reject, no helpful hint
    console.error(
      '[github-callback] HMAC verification failed — possible state forgery attempt'
    )
    return portfolioUrlWithError('invalid_state_signature')
  }

  // ── 2. Belt-and-suspenders: cross-check Clerk session if present ───────────
  //
  // The callback is a public route because GitHub redirects here without a
  // session cookie on some browsers. If a session IS present, we ensure the
  // authenticated user is the same one who started the OAuth flow.
  try {
    const { userId: clerkId } = auth()
    if (clerkId) {
      // Resolve current authenticated user's DB record
      const [sessionUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1)

      if (sessionUser && sessionUser.id !== dbUserId) {
        // Authenticated user does not match the state — likely a confused
        // deputy or replay attempt. Abort immediately.
        console.error(
          `[github-callback] Session userId "${sessionUser.id}" does not match ` +
          `state userId "${dbUserId}" — aborting to prevent cross-user contamination`
        )
        return portfolioUrlWithError('user_mismatch')
      }
    }
  } catch {
    // auth() throws outside of Clerk context in some edge cases — safe to ignore
  }

  // ── 3. Confirm user exists in DB ──────────────────────────────────────────
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

  // ── 4. Exchange code → access token ───────────────────────────────────────
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

  // ── 5. Encrypt and upsert into connected_accounts (strict userId filter) ──
  let encryptedToken: string
  try {
    encryptedToken = encrypt(accessToken)
  } catch (err) {
    console.error('[github-callback] Encryption failed:', err)
    return portfolioUrlWithError('encryption_failed')
  }

  try {
    const [existing] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, user.id),   // ← strict: verified user only
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
        .where(
          and(
            eq(connectedAccounts.id, existing.id),
            eq(connectedAccounts.userId, user.id)  // ← double-guard on UPDATE
          )
        )
    } else {
      await db.insert(connectedAccounts).values({
        userId: user.id,                            // ← verified DB user, not raw state
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

  console.log(`[github-callback] GitHub account connected for userId=${user.id} (${githubUsername})`)

  // Success — redirect back to portfolio page
  portfolioUrl.searchParams.set('github_connected', '1')
  return NextResponse.redirect(portfolioUrl)
}
