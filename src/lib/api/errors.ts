import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/api";

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      }
    );
  }

  if (error instanceof ServiceUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
