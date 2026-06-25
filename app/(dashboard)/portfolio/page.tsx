import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { portfolioConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PortfolioConfig as PortfolioConfigComponent } from "@/components/portfolio/portfolio-config";
import { getGitHubToken } from "@/lib/github/get-token";

export const metadata = {
  title: "Portfolio — Career Autopilot",
  description: "Deploy and manage your developer portfolio automatically.",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage() {
  const user = await requireUser();

  const [portfolioCfg, githubToken] = await Promise.all([
    db
      .select()
      .from(portfolioConfig)
      .where(eq(portfolioConfig.userId, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getGitHubToken(user.id),
  ]);

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Portfolio</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {portfolioCfg?.deployUrl
            ? "Your portfolio is live — deployed automatically on new achievements"
            : "Connect GitHub to deploy your portfolio with one click"}
        </p>
      </div>

      <PortfolioConfigComponent
        portfolioConfig={portfolioCfg}
        hasGitHub={Boolean(githubToken)}
        githubToken={githubToken ?? null}
      />
    </div>
  );
}
