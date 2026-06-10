import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO: Return list of GitHub repos for the authenticated user
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
