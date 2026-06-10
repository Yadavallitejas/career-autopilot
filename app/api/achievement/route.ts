import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Validate input, create achievement record, enqueue QStash job
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO: Return paginated achievement list for the authenticated user
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
