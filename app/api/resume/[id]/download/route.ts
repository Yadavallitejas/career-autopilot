import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // TODO: Stream resume PDF download; append watermark for free tier
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
