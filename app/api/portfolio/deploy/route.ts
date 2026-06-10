import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Trigger portfolio deployment to the detected platform
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
