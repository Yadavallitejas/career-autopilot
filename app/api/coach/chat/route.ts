import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Stream career coach AI response
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
