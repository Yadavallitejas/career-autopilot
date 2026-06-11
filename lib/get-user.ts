import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/db/schema";

/**
 * Returns the DB user record for the currently authenticated Clerk session,
 * or null if the user is not signed in or has no DB record yet.
 *
 * Safe to call from Server Components and Route Handlers.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = auth();
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  return user ?? null;
}

/**
 * Returns the DB user record for the currently authenticated Clerk session.
 * Redirects to /sign-in if the user is not authenticated or has no DB record.
 *
 * Use in Server Components / Server Actions that require a logged-in user.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}
