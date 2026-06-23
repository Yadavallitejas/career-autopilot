import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-user";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Rocket } from "lucide-react";

export const metadata = {
  title: "Welcome to Career Autopilot — Set up your account",
  description:
    "Complete your profile, add your resume, and connect GitHub to unlock the full Career Autopilot experience.",
};

export default async function OnboardingPage() {
  // Require auth — unauthenticated users go to sign-in
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Already onboarded — send straight to dashboard
  if (user.onboardingCompleted) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 h-16 flex items-center px-6 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-emerald-400">
            <Rocket size={20} strokeWidth={2.5} />
          </span>
          <span className="font-bold text-white text-sm tracking-tight">
            Career Autopilot
          </span>
        </div>
      </header>

      {/* Wizard content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-16">
        <OnboardingWizard />
      </main>

      {/* Bottom note */}
      <footer className="shrink-0 py-4 text-center">
        <p className="text-xs text-zinc-700">
          Secure · Private · No spam · Cancel anytime
        </p>
      </footer>
    </div>
  );
}
