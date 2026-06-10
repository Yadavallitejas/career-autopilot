import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // TODO: Return current processing status for the given achievement
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
