import { requireUser } from "@/lib/get-user";

import { db } from "@/db";
import { achievements, posts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AchievementDetail } from "@/components/achievement/achievement-detail";
import { Paperclip, Award, Building2, Calendar, Star, Hash, BadgeCheck } from "lucide-react";
import type { ExtractedCertificate } from "@/lib/ai/extract-certificate";

export const metadata = {
  title: "Achievement Details — Career Autopilot",
  description: "View and edit details, AI classification, and social drafts for this career achievement.",
};

interface PageProps {
  params: {
    id: string;
  };
}

// ---------------------------------------------------------------------------
// CertificateCard — shown when extractedContent is available
// ---------------------------------------------------------------------------

function CertificateCard({ cert, fileUrl, fileType, fileName }: {
  cert: ExtractedCertificate;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
}) {
  return (
    <div className="border border-emerald-500/25 bg-emerald-500/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-emerald-500/15 bg-emerald-500/10">
        <Award size={14} className="text-emerald-400 shrink-0" />
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
          Certificate Detected
        </span>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
          >
            <Paperclip size={11} />
            {fileName ?? (fileType === "pdf" ? "View PDF" : "View file")}
          </a>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Cert name */}
        {cert.certificationName && (
          <p className="text-sm font-bold text-foreground leading-snug">
            {cert.certificationName}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {cert.issuingOrganization && (
            <span className="flex items-center gap-1.5">
              <Building2 size={11} className="text-emerald-400/60" />
              <span>Issued by{" "}<span className="text-foreground font-medium">{cert.issuingOrganization}</span></span>
            </span>
          )}
          {cert.completionDate && (
            <span className="flex items-center gap-1.5">
              <Calendar size={11} className="text-emerald-400/60" />
              <span>Completed{" "}<span className="text-foreground font-medium">{cert.completionDate}</span></span>
            </span>
          )}
          {cert.score && (
            <span className="flex items-center gap-1.5">
              <Star size={11} className="text-amber-400/80" />
              <span>Score{" "}<span className="text-foreground font-medium">{cert.score}</span></span>
            </span>
          )}
          {cert.credentialId && (
            <span className="flex items-center gap-1.5">
              <BadgeCheck size={11} className="text-sky-400/70" />
              <span>ID{" "}<span className="text-foreground font-medium font-mono text-[11px]">{cert.credentialId}</span></span>
            </span>
          )}
        </div>

        {/* Skills as pill badges */}
        {cert.skills && cert.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {cert.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium"
              >
                <Hash size={9} />
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Course description */}
        {cert.courseDescription && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-emerald-500/10 pt-2.5">
            {cert.courseDescription}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttachmentSection — handles new fileUrl system + legacy mediaUrl
// ---------------------------------------------------------------------------

function AttachmentSection({ achievement }: {
  achievement: {
    mediaUrl?: string | null;
    mediaType?: string | null;
    fileUrl?: string | null;
    fileType?: string | null;
    fileName?: string | null;
  };
}) {
  // New system: fileUrl
  if (achievement.fileUrl) {
    const isImage = achievement.fileType === "image";
    return (
      <div className="border border-border bg-card/40 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          Certificate attached:{" "}
          <span className="text-foreground truncate max-w-[260px]">
            {achievement.fileName ?? "uploaded file"}
          </span>
        </div>
        {isImage ? (
          <img
            src={achievement.fileUrl}
            alt="Certificate"
            className="max-h-40 rounded border border-border object-contain"
          />
        ) : (
          <a
            href={achievement.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:underline inline-block"
          >
            View uploaded certificate →
          </a>
        )}
      </div>
    );
  }

  // Legacy system: mediaUrl
  if (achievement.mediaUrl) {
    return (
      <div className="border border-border bg-card/40 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attached {achievement.mediaType === "pdf" ? "document" : "image"}
        </div>
        {achievement.mediaType === "pdf" ? (
          <a
            href={achievement.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:underline inline-block"
          >
            View uploaded certificate →
          </a>
        ) : (
          <img
            src={achievement.mediaUrl}
            alt="Achievement attachment"
            className="max-h-40 rounded border border-border object-contain"
          />
        )}
        <p className="text-xs text-muted-foreground">
          This document&apos;s content was used to classify your achievement.
        </p>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AchievementDetailPage({ params }: PageProps) {
  const user = await requireUser();

  // Fetch achievement
  const [achievement] = await db
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.id, params.id),
        eq(achievements.userId, user.id)
      )
    )
    .limit(1);

  if (!achievement) {
    notFound();
  }

  // Fetch associated posts
  const postRows = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      draftText: posts.draftText,
      status: posts.status,
    })
    .from(posts)
    .where(eq(posts.achievementId, achievement.id));

  // Parse extractedContent for the Certificate Detected card
  let parsedCert: ExtractedCertificate | null = null;
  if (achievement.extractedContent) {
    try {
      parsedCert = JSON.parse(achievement.extractedContent) as ExtractedCertificate;
    } catch {
      // Silently ignore malformed JSON — cert card simply won't render
    }
  }

  const hasMediaContent =
    parsedCert !== null ||
    achievement.fileUrl != null ||
    achievement.mediaUrl != null;

  return (
    <div className="h-full pb-20 md:pb-0">
      <AchievementDetail
        achievement={achievement}
        posts={postRows}
        user={user}
        mediaSection={
          hasMediaContent ? (
            <div className="space-y-3">
              {/* Certificate Detected card — above AI reasoning */}
              {parsedCert && (
                <CertificateCard
                  cert={parsedCert}
                  fileUrl={achievement.fileUrl}
                  fileType={achievement.fileType}
                  fileName={achievement.fileName}
                />
              )}
              {/* File/media attachment section */}
              <AttachmentSection achievement={achievement} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
