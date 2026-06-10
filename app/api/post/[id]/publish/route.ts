import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // TODO: Publish post to LinkedIn via API (Pro only)
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
