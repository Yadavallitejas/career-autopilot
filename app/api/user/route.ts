import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO: Return authenticated user profile and plan details
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // TODO: Update user profile fields
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
