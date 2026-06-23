import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, resumeVersions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve DB user
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch version with ownership check
  const [version] = await db
    .select({ fileUrl: resumeVersions.fileUrl })
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.id, params.id),
        eq(resumeVersions.userId, user.id)
      )
    )
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Proxy the file from Supabase Storage so we can set Content-Disposition

  // The fileUrl field in the DB now typically stores the storage path,
  // e.g. "resumes/userId/timestamp.pdf", or sometimes a full URL.
  let bucket = "resumes";
  let filePath = version.fileUrl;

  if (version.fileUrl.startsWith("http://") || version.fileUrl.startsWith("https://")) {
    try {
      const url = new URL(version.fileUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
      if (pathMatch) {
        bucket = pathMatch[1];
        filePath = pathMatch[2];
      }
    } catch {
      // Ignore URL parsing errors and try using the raw string
    }
  } else if (version.fileUrl.startsWith("resumes/")) {
    // If it includes the bucket name at the start, strip it since .from('resumes') already implies it
    // Actually, in upload route we store `resumes/${user.id}/...`
    // Supabase .upload() and .createSignedUrl() within .from('resumes') expects the path WITHOUT the bucket name.
    // Let's verify what `resumes/` means. Ah, wait. The builder does:
    // supabase.storage.from("resumes").upload(`resumes/${userId}/...`)
    // If it literally uploads to a folder called `resumes` inside the `resumes` bucket, then the path is `resumes/...`.
    // Let's just use filePath as is, since that's what was passed to upload().
  }

  const supabase = getStorageClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error || !data) {
    console.error("[resume/download] Storage download failed:", error);

    // Fall back to redirecting to a signed URL
    const { getResumeSignedUrl } = await import("@/lib/storage/get-signed-url");
    const signedUrl = await getResumeSignedUrl(version.fileUrl);
    return NextResponse.redirect(signedUrl);
  }

  const arrayBuffer = await data.arrayBuffer();
  const filename = `resume-${params.id.slice(0, 8)}.pdf`;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(arrayBuffer.byteLength),
      "Cache-Control": "private, no-cache",
    },
  });
}
