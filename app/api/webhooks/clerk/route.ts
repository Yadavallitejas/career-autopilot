import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Verify Svix signature, handle user.created → create DB record
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
