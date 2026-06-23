import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, achievements, resumeVersions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { addBulletToResume, generateResumePdf } from "@/lib/resume/builder";
import type { ResumeData } from "@/lib/resume/builder";
import { callAI } from "@/lib/ai/client";
import { stripMarkdownFences, buildResumeRulesBlock } from "@/lib/ai/classify";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. Auth check
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Resolve DB user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 3. Fetch achievement
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
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }

  // 4. Parse action
  let action: "add_to_resume" | "remove_from_resume";
  try {
    const body = await req.json();
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (action !== "add_to_resume" && action !== "remove_from_resume") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // ─── ACTION: add_to_resume ──────────────────────────────────────────────────
  if (action === "add_to_resume") {
    // A. Generate bullet if not exists
    let bullet = achievement.resumeBullet;
    let section = achievement.resumeSection;

    // Fetch user's current resume version
    const [currentResume] = await db
      .select()
      .from(resumeVersions)
      .where(
        and(
          eq(resumeVersions.userId, user.id),
          eq(resumeVersions.isCurrent, true)
        )
      )
      .limit(1);

    if (!currentResume) {
      return NextResponse.json(
        { error: "No current resume found. Please build or upload a resume first." },
        { status: 400 }
      );
    }

    if (currentResume.templateId === "uploaded") {
      return NextResponse.json(
        { error: "Cannot modify an uploaded PDF/DOCX resume. Please use the Resume Builder to generate a resume." },
        { status: 400 }
      );
    }

    let existingData: ResumeData | null = null;
    try {
      existingData = JSON.parse(currentResume.rawText) as ResumeData;
    } catch {
      existingData = null;
    }

    if (!existingData) {
      return NextResponse.json(
        { error: "Your current resume text is plain text. Updating structured resumes requires a resume built with the Resume Builder." },
        { status: 400 }
      );
    }

    let bulletStr: string;
    let sectionStr: string;

    if (!bullet || !section) {
      const rulesBlock = buildResumeRulesBlock(user.resumeRules as any);
      const prompt = `Write an ATS-optimized resume bullet and choose the appropriate section for this professional achievement.
Return a JSON object matching this schema exactly:
{
  "resumeSection": "Certifications" | "Projects" | "Experience" | "Education" | "Open Source" | "Awards",
  "resumeBullet": "ATS-optimized bullet text"
}

Achievement: "${achievement.rawInput}"

Existing resume context (first 2000 chars): "${currentResume.rawText.slice(0, 2000)}"

Rules:
- The bullet must follow the format: [Strong action verb] [what] [measurable result if available]
- Keep it concise (under 20 words)
- Choose the best matching section (Experience, Projects, Certifications, etc.)${rulesBlock}`;

      try {
        const responseText = await callAI({
          system: "You are a professional resume writer and ATS optimization expert.",
          prompt,
          maxTokens: 300,
        });
        const parsed = JSON.parse(stripMarkdownFences(responseText));
        bulletStr = parsed.resumeBullet || achievement.rawInput;
        sectionStr = parsed.resumeSection || "Experience";
      } catch (err) {
        console.error("[override] AI bullet generation failed:", err);
        bulletStr = achievement.rawInput;
        sectionStr = "Experience";
      }
    } else {
      bulletStr = bullet;
      sectionStr = section;
    }

    // B. Add bullet to resume data
    const updatedData = await addBulletToResume(
      existingData,
      sectionStr,
      bulletStr
    );

    // C. Re-compile PDF using generateResumePdf (which uploads to Supabase)
    let fileUrl: string;
    let rawText: string;
    try {
      const templateId = (currentResume.templateId as "classic" | "modern") || "classic";
      const result = await generateResumePdf({
        userId: user.id,
        templateId,
        isPro: user.plan === "pro" || user.plan === "team",
        resumeData: updatedData,
      });
      fileUrl = result.fileUrl;
      rawText = JSON.stringify(updatedData);
    } catch (genErr) {
      console.error("[override] PDF compilation failed:", genErr);
      return NextResponse.json(
        { error: "PDF compilation failed. Please try again." },
        { status: 500 }
      );
    }

    // D. Transaction to update DB
    await db.transaction(async (tx) => {
      // 1. Mark existing versions as not current
      await tx
        .update(resumeVersions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(resumeVersions.userId, user.id),
            eq(resumeVersions.isCurrent, true)
          )
        );

      // 2. Insert new version
      await tx.insert(resumeVersions).values({
        userId: user.id,
        templateId: currentResume.templateId ?? "classic",
        fileUrl,
        rawText,
        isCurrent: true,
        changesSummary: `Added bullet to ${sectionStr}: ${bulletStr.slice(0, 80)}…`,
      });

      // 3. Update achievement
      await tx
        .update(achievements)
        .set({
          classifiedResumeWorthy: true,
          resumeBullet: bulletStr,
          resumeSection: sectionStr,
        })
        .where(eq(achievements.id, achievement.id));
    });

    return NextResponse.json({ success: true, action: "add_to_resume", bullet: bulletStr, section: sectionStr });
  }

  // ─── ACTION: remove_from_resume ─────────────────────────────────────────────
  if (action === "remove_from_resume") {
    await db.transaction(async (tx) => {
      // Get user's resume versions
      const versions = await tx
        .select({ id: resumeVersions.id, isCurrent: resumeVersions.isCurrent })
        .from(resumeVersions)
        .where(eq(resumeVersions.userId, user.id))
        .orderBy(desc(resumeVersions.createdAt));

      if (versions.length > 1) {
        const currentIdx = versions.findIndex((v) => v.isCurrent);
        if (currentIdx !== -1) {
          const prevVersion = versions[currentIdx === 0 ? 1 : 0];

          // Set current to not current
          await tx
            .update(resumeVersions)
            .set({ isCurrent: false })
            .where(eq(resumeVersions.id, versions[currentIdx].id));

          // Set previous to current
          await tx
            .update(resumeVersions)
            .set({ isCurrent: true })
            .where(eq(resumeVersions.id, prevVersion.id));
        }
      }

      // Update achievement status
      await tx
        .update(achievements)
        .set({ classifiedResumeWorthy: false })
        .where(eq(achievements.id, achievement.id));
    });

    return NextResponse.json({ success: true, action: "remove_from_resume" });
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
