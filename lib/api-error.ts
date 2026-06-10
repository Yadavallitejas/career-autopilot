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
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: code, message, details }, { status });
}

export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return errorResponse(error.code, error.message, error.status, error.details);
  }

  console.error("Unhandled API error:", error);
  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
}
