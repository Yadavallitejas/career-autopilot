import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Verify Razorpay webhook signature, handle payment.captured → upgrade plan
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
