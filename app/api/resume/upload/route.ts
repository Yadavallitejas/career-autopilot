import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, resumeVersions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage/client";

// pdf-parse and mammoth use CommonJS — require() avoids ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

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

  // Parse multipart form
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form" },
      { status: 400 }
    );
  }

  const fileField = form.get("file");
  if (!fileField || typeof fileField === "string") {
    return NextResponse.json(
      { error: "No file field in form" },
      { status: 400 }
    );
  }

  const file = fileField as File;

  // Validate MIME
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are accepted" },
      { status: 415 }
    );
  }

  // Validate size
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 413 }
    );
  }

  // Read to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract raw text
  let rawText: string;
  try {
    if (file.type === "application/pdf") {
      const result = await pdfParse(buffer);
      rawText = result.text;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    }
  } catch (extractErr) {
    console.error("[resume/upload] Text extraction failed:", extractErr);
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 422 }
    );
  }

  // Upload original file to Supabase Storage
  const ext = file.type === "application/pdf" ? "pdf" : "docx";
  const storagePath = `resumes/${user.id}/${Date.now()}.${ext}`;
  const supabase = getStorageClient();

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[resume/upload] Storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Storage upload failed" },
      { status: 502 }
    );
  }

  const { data: urlData } = supabase.storage
    .from("resumes")
    .getPublicUrl(storagePath);

  const fileUrl = urlData.publicUrl;

  // Persist to DB — mark all previous as not current, insert new current
  await db.transaction(async (tx) => {
    await tx
      .update(resumeVersions)
      .set({ isCurrent: false })
      .where(
        and(
          eq(resumeVersions.userId, user.id),
          eq(resumeVersions.isCurrent, true)
        )
      );

    await tx.insert(resumeVersions).values({
      userId: user.id,
      templateId: "uploaded",
      fileUrl,
      rawText: rawText.slice(0, 200_000), // cap at 200k chars to keep DB sane
      isCurrent: true,
      changesSummary: `Uploaded ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
    });
  });

  // Fetch the newly inserted version ID
  const [newVersion] = await db
    .select({ id: resumeVersions.id })
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.userId, user.id),
        eq(resumeVersions.isCurrent, true)
      )
    )
    .limit(1);

  return NextResponse.json({
    versionId: newVersion?.id,
    fileUrl,
    rawText: rawText.slice(0, 2000), // return a preview only
  });
}
