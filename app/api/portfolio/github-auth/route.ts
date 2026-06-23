/**
 * GET /api/portfolio/github-auth
 *
 * Redirects the authenticated user to GitHub's OAuth authorization page.
 * Scopes: read:user, user:email, repo (needed to list private repos + enable Pages).
 *
 * The user's DB UUID is embedded in the `state` parameter so the callback
 * can match the token to the right DB record without an additional lookup.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured (missing GITHUB_CLIENT_ID)' },
      { status: 503 }
    )
  }

  // Resolve DB user ID
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Build a state token: dbUserId + random nonce (prevents CSRF)
  // Format: <userId>.<random-hex>
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = `${user.id}.${nonce}`

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/portfolio/github-callback`,
    scope: 'read:user user:email repo',
    state,
  })

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  )
}
