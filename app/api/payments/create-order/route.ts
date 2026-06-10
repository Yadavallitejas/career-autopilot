import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: Create Razorpay order and return order ID + key to client
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
