import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
