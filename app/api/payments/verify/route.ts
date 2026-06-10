import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Verify Razorpay payment signature and upgrade user plan
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
