import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // TODO: Return post draft by ID
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // TODO: Update post draft content
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
