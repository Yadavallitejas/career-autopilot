// CRITICAL: forces Node.js runtime so pdf/docx parsing works in serverless
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Allow up to 30 seconds for large file extraction
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users, resumeVersions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getStorageClient } from '@/lib/storage/client'
import { extractTextFromPdf, extractTextFromDocx } from '@/lib/resume/extract-text'
import { structurizeResumeText } from '@/lib/resume/structurize'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse multipart form
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const fileField = formData.get('file')
    if (!fileField || typeof fileField === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const file = fileField as File

    // 3. Validate MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF or DOCX file.' },
        { status: 415 }
      )
    }

    // 4. Validate size
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 413 }
      )
    }

    // 5. Convert File → Buffer (App Router pattern)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 6. Extract text based on file type
    let rawText: string
    try {
      if (file.type === 'application/pdf') {
        rawText = await extractTextFromPdf(buffer)
      } else {
        rawText = await extractTextFromDocx(buffer)
      }
    } catch (extractError) {
      console.error('[Resume Upload] Text extraction failed:', extractError)
      return NextResponse.json(
        {
          error:
            'Could not extract text from this file. Please try a different file or use our resume builder.',
        },
        { status: 422 }
      )
    }

    // 7. Sanity-check extracted text
    if (rawText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            'The file appears to be empty or image-only. Please upload a text-based PDF or DOCX.',
        },
        { status: 422 }
      )
    }

    // 8. Resolve DB user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 9. Upload original file to Supabase Storage
    const ext = file.type === 'application/pdf' ? 'pdf' : 'docx'
    const storagePath = `resumes/${user.id}/${Date.now()}.${ext}`
    const supabase = getStorageClient()

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[Resume Upload] Supabase upload failed:', uploadError)
      // Non-fatal — we have the text, proceed without a stored file URL
    }

    // 10. AI-extract structured data (non-fatal — upload always succeeds)
    let structuredData: object | null = null
    try {
      structuredData = await structurizeResumeText(rawText)
    } catch (structErr) {
      console.error(
        '[Resume Upload] Structurize failed, continuing without it:',
        structErr
      )
      // structuredData stays null; portfolio-from-resume will surface a
      // clear error asking the user to re-upload or build from scratch.
    }

    // 11. Persist to DB — mark existing current as stale, insert new version
    const [newVersion] = await db.transaction(async (tx) => {
      await tx
        .update(resumeVersions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(resumeVersions.userId, user.id),
            eq(resumeVersions.isCurrent, true)
          )
        )

      const inserted = await tx
        .insert(resumeVersions)
        .values({
          userId: user.id,
          templateId: 'uploaded',
          fileUrl: uploadError ? '' : storagePath,
          rawText: rawText.slice(0, 200_000), // cap at 200k chars
          isCurrent: true,
          changesSummary: `Uploaded ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
          structuredData,
        })
        .returning()

      await tx
        .update(users)
        .set({ resumeSource: 'uploaded', autoApplyResumeUpdates: false })
        .where(eq(users.id, user.id))

      return inserted
    })

    // We still return a temporary signed url to the client so they can display it immediately.
    let signedUrl = ''
    if (!uploadError) {
      const { data: urlData } = await supabase.storage
        .from('resumes')
        .createSignedUrl(storagePath, 60 * 60) // 1 hour
      signedUrl = urlData?.signedUrl ?? ''
    }

    return NextResponse.json({
      versionId: newVersion?.id,
      fileUrl: signedUrl,
      rawTextLength: rawText.length,
      rawTextPreview: rawText.slice(0, 500),
      message: 'Resume uploaded successfully',
    })
  } catch (error) {
    console.error('[Resume Upload] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
