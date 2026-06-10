import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Verify QStash signature, execute AI pipeline for queued achievement
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
