import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  // TODO: Return connection status for the given platform
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  // TODO: Disconnect the given platform account
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
