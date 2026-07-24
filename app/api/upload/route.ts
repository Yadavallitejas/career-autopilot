import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadFile } from "@/lib/storage/client";

// ---------------------------------------------------------------------------
// Allowed MIME types → fileType category
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES: Record<string, "image" | "pdf" | "document"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = "post-media";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip characters unsafe for storage paths and collapse spaces/dots. */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/[^a-z0-9.\-_]/g, "") // strip anything else
    .replace(/-{2,}/g, "-")        // collapse multiple hyphens
    .slice(0, 128);                 // hard cap length
}

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const { userId: clerkId } = auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 10MB." },
        { status: 400 }
      );
    }

    // 4. MIME type check
    const mimeType = file.type;
    const fileType = ALLOWED_MIME_TYPES[mimeType];
    if (!fileType) {
      return NextResponse.json(
        { error: "File type not supported" },
        { status: 400 }
      );
    }

    // 5. Build storage path
    //    achievements/{clerkId}/{timestamp}-{sanitized-filename}
    const fileName = file.name;
    const safeName = sanitizeFilename(fileName);
    const storagePath = `achievements/${clerkId}/${Date.now()}-${safeName}`;

    // 6. Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    let fileUrl: string;
    try {
      fileUrl = await uploadFile(buffer, storagePath, mimeType, BUCKET);
    } catch (uploadErr) {
      console.error("[POST /api/upload] Supabase upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    console.log(`[upload] ${fileType} uploaded by ${clerkId}: ${storagePath}`);

    // 7. Return structured metadata
    return NextResponse.json(
      {
        fileUrl,
        fileType,
        fileName,
        mimeType,
        fileSize: file.size,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/upload] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
