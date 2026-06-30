import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getCurrentUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const existing = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
  if (existing.length) return existing[0]

  // SELF-HEALING: the Clerk webhook may not have fired yet (common right 
  // after signup/email verification). Fetch the user directly from Clerk 
  // and create the row ourselves instead of treating this as "not signed in."
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email = clerkUser.emailAddresses[0]?.emailAddress
  if (!email) return null

  try {
    const [newUser] = await db.insert(users).values({
      clerkId,
      email,
      plan: 'free',
      onboardingCompleted: false
    })
    .onConflictDoNothing()  // in case the webhook fires a split-second later too
    .returning()

    if (newUser) return newUser

    // If onConflictDoNothing skipped the insert (webhook won the race), 
    // re-fetch the row that now exists
    const retried = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    return retried[0] ?? null

  } catch (error) {
    console.error('[getCurrentUser] Self-heal insert failed:', error)
    return null
  }
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/sign-in')
  }
  return user
}
