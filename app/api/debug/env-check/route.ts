export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Simple protection — require a query param matching DEBUG_KEY
  const key = req.nextUrl.searchParams.get('key')
  if (key !== process.env.DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const required = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'ANTHROPIC_API_KEY',
    'XAI_API_KEY',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'ENCRYPTION_KEY',
    'NEXT_PUBLIC_APP_URL'
  ]

  const status = required.reduce((acc, k) => {
    const val = process.env[k]
    acc[k] = {
      present: !!val,
      // show a hint only, never the real value
      hint: val ? `${val.slice(0, 4)}...(${val.length} chars)` : null
    }
    return acc
  }, {} as Record<string, { present: boolean; hint: string | null }>)

  return NextResponse.json({
    runtime: 'nextjs-server',
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vars: status
  })
}
