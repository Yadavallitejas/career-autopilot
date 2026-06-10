import { auth } from "@clerk/nextjs/server";
import { ApiError } from "@/lib/api-error";

/**
 * Returns the authenticated Clerk userId or throws a 401 ApiError.
 * Use inside API route handlers.
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const { userId } = auth();
  if (!userId) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }
  return userId;
}
