import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Upload file to Supabase Storage, return public URL
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
