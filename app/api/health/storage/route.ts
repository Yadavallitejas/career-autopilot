import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/health/storage
 *
 * Lists all Supabase Storage buckets visible to the service role key.
 * Use this to verify which buckets actually exist before debugging upload errors.
 *
 * Expected buckets:
 *   - career-autopilot-media      (user file uploads, images, PDFs)
 *   - career-autopilot-portfolios (generated HTML portfolios)
 *   - post-media                  (achievement / post media)
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json(
      { error: 'Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    )
  }

  const sb = createClient(url, key)
  const { data, error } = await sb.storage.listBuckets()

  return NextResponse.json({
    buckets: data?.map((b) => b.name) ?? [],
    error: error?.message ?? null,
  })
}
