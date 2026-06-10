import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Accept PDF/DOCX upload, extract text, store parsed resume
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
