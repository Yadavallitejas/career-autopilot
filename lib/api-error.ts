import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  const requestId = crypto.randomUUID();
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requestId } },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled API error:", error, { requestId });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId } },
    { status: 500 }
  );
}
