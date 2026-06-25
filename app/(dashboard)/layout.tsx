import Script from "next/script";
import { requireUser } from "@/lib/get-user";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { redirect } from "next/navigation";
import type { User } from "@/db/schema";

// Server-side user context — passed directly as props to client boundary
export type DashboardUser = Pick<User, "id" | "email" | "plan" | "createdAt">;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth gate: redirects to /sign-in if not authenticated
  const user = await requireUser();

  // Onboarding gate: new users must complete the wizard before using the app
  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const dashboardUser: DashboardUser = {
    id: user.id,
    email: user.email,
    plan: user.plan,
    createdAt: user.createdAt,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Fixed sidebar — hidden on mobile (<md), shown on md+ */}
      <Sidebar user={dashboardUser} />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        {/*
          pb-16 md:pb-0 — on mobile the bottom tab bar is 64px tall (h-16).
          This padding prevents page content from being hidden behind it.
        */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Razorpay checkout script — loaded lazily after page is interactive */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
    </div>
  );
}
