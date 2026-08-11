import { z } from "zod";

/**
 * One error shape for every route handler (system design §7):
 *
 *   { error: { code, message, details? } }
 *
 * A stable code enum means the client can branch on failure without parsing
 * prose, and the messages stay free to change.
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  /** Blocked because other records point at this one — see ImpactPreviewDialog. */
  "REFERENCED",
  /** An application-level invariant the database cannot express. */
  "PRECONDITION_FAILED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Field-level detail, keyed by form path so React Hook Form can consume it directly. */
export type ErrorDetails = Record<string, string[]>;

export type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
  };
};

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  REFERENCED: 409,
  PRECONDITION_FAILED: 412,
  INTERNAL: 500,
};

/**
 * Thrown by services; caught and serialised at the route-handler boundary.
 * Services stay free of anything that knows what HTTP is.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS[this.code];
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function statusForCode(code: ErrorCode): number {
  return STATUS[code];
}

/**
 * Flattens a Zod failure into the field-level shape React Hook Form expects.
 * Root-level issues land under `_root` so nothing is silently dropped.
 */
export function zodToDetails(error: z.ZodError): ErrorDetails {
  const details: ErrorDetails = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

export function validationError(error: z.ZodError): AppError {
  return new AppError(
    "VALIDATION_ERROR",
    "Some fields need attention.",
    zodToDetails(error),
  );
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiError).error?.code === "string"
  );
}
