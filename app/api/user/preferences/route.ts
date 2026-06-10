import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO: Return user preferences (email notifications, brand voice, etc.)
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // TODO: Update user preferences
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
