import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin — Career Autopilot",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const primaryEmail =
    clerkUser?.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? "";

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(primaryEmail.toLowerCase())) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950 border border-red-800 text-red-400 font-mono text-xs font-bold tracking-wider">
            ⚡ ADMIN
          </span>
          <span className="text-white font-semibold text-sm">
            Career Autopilot
          </span>
          <span className="text-zinc-600 text-xs hidden sm:block">
            — Control Panel
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-zinc-500 text-xs hidden sm:block">
              {primaryEmail}
            </span>
            <a
              href="/dashboard"
              className="text-zinc-400 text-sm hover:text-white transition-colors"
            >
              ← Back to App
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
