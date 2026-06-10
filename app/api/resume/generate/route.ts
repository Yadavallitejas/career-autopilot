import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Generate or rebuild resume from form data
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
