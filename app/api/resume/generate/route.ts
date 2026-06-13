import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, resumeVersions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateResumePdf } from "@/lib/resume/builder";
import type { ResumeData } from "@/lib/resume/builder";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve DB user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse body
  let resumeData: ResumeData;
  try {
    resumeData = (await req.json()) as ResumeData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic validation
  if (!resumeData.fullName || !resumeData.email) {
    return NextResponse.json(
      { error: "fullName and email are required" },
      { status: 422 }
    );
  }

  // Generate PDF and upload to Supabase
  let fileUrl: string;
  let rawText: string;
  try {
    const result = await generateResumePdf({
      userId: user.id,
      templateId: "classic",
      isPro: user.plan === "pro" || user.plan === "team",
      resumeData,
    });
    fileUrl = result.fileUrl;
    rawText = result.rawText;
  } catch (genErr) {
    console.error("[resume/generate] PDF generation failed:", genErr);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 }
    );
  }

  // Persist version in DB (in a transaction)
  let versionId: string;
  await db.transaction(async (tx) => {
    // Mark previous current versions as not current
    await tx
      .update(resumeVersions)
      .set({ isCurrent: false })
      .where(
        and(
          eq(resumeVersions.userId, user.id),
          eq(resumeVersions.isCurrent, true)
        )
      );

    // Insert new version
    const [inserted] = await tx
      .insert(resumeVersions)
      .values({
        userId: user.id,
        templateId: "classic",
        fileUrl,
        rawText,
        isCurrent: true,
        changesSummary: `Generated resume for ${resumeData.fullName}`,
      })
      .returning({ id: resumeVersions.id });

    versionId = inserted!.id;
  });

  return NextResponse.json({ versionId: versionId!, fileUrl });
}
