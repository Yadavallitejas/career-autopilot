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
  // Extract the storage path from the public URL
  const url = new URL(version.fileUrl);
  // The path after /storage/v1/object/public/<bucket>/<path>
  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);

  if (pathMatch) {
    const [, bucketPath] = pathMatch;
    const [bucket, ...rest] = bucketPath.split("/");
    const filePath = rest.join("/");
    const supabase = getStorageClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      console.error("[resume/download] Storage download failed:", error);
      // Fall back to redirect
      return NextResponse.redirect(version.fileUrl);
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

  // Fallback: redirect to the public URL directly
  return NextResponse.redirect(version.fileUrl);
}
