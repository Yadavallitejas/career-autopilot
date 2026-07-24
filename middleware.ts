import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding",
  "/api/webhooks/(.*)",
  "/api/debug/(.*)",
  "/api/portfolio/github-callback",  // GitHub OAuth callback — no session yet
  "/pricing",
  "/api/health(.*)",                 // All health-check endpoints (e.g. /api/health/storage)
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    // Require an active session first
    const { userId, sessionClaims } = auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Verify email against ADMIN_EMAILS allowlist
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // Clerk session claims include the primary email in emailAddresses
    // We read it from the JWT's 'email' claim (set in Clerk Dashboard → Sessions → Customize token)
    // Fallback: check via sessionClaims.email or primaryEmail
    const userEmail =
      (sessionClaims?.email as string | undefined)?.toLowerCase() ?? "";

    if (!adminEmails.includes(userEmail)) {
      // Not an admin — send them to the dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  }

  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
