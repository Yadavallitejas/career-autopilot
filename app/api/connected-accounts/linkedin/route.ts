import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO: Handle LinkedIn OAuth callback, store encrypted token
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  // TODO: Disconnect LinkedIn account
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
