import { requireUser } from "@/lib/get-user";
import { db } from "@/db";
import { resumeVersions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically imported — 30KB component with LCS diff, modals, and upload logic.
// ssr:false keeps it off the server bundle and out of the critical render path.
const ResumeViewer = dynamic(
  () => import("@/components/resume/resume-viewer").then((m) => ({ default: m.ResumeViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-4rem)]">
        <div className="w-full md:w-[280px] border-r border-zinc-800 p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-[700px] rounded-lg" />
        </div>
      </div>
    ),
  }
);

export const metadata = {
  title: "Resume — Career Autopilot",
  description: "Manage and preview your resume versions with AI-powered updates.",
};

export default async function ResumePage() {
  const user = await requireUser();

  const versions = await db
    .select({
      id: resumeVersions.id,
      fileUrl: resumeVersions.fileUrl,
      rawText: resumeVersions.rawText,
      isCurrent: resumeVersions.isCurrent,
      changesSummary: resumeVersions.changesSummary,
      createdAt: resumeVersions.createdAt,
      templateId: resumeVersions.templateId,
    })
    .from(resumeVersions)
    .where(eq(resumeVersions.userId, user.id))
    .orderBy(desc(resumeVersions.createdAt));

  return (
    <div className="h-full pb-20 md:pb-0">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Resume</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {versions.length > 0
            ? `${versions.length} version${versions.length !== 1 ? "s" : ""} tracked — AI updates automatically on new achievements`
            : "Upload or build your resume to start tracking versions"}
        </p>
      </div>

      <ResumeViewer versions={versions} userId={user.id} />
    </div>
  );
}
