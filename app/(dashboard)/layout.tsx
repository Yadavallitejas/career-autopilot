import Script from "next/script";
import { requireUser } from "@/lib/get-user";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
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

  const dashboardUser: DashboardUser = {
    id: user.id,
    email: user.email,
    plan: user.plan,
    createdAt: user.createdAt,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Fixed sidebar — hidden on mobile */}
      <Sidebar user={dashboardUser} />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar rendered inside Sidebar at small breakpoints */}

      {/* Razorpay checkout script — loaded lazily after page is interactive */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
    </div>
  );
}
