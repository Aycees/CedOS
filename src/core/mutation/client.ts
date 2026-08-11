"use client";

import { type ApiError, AppError, isApiError } from "@/core/errors";

/**
 * The typed mutation client — the ONLY place in the application that calls
 * `fetch`.
 *
 * This is the load-bearing rule from technical decisions §1. It is not
 * stylistic tidiness: validation, error normalisation and cache invalidation
 * all live at this seam, and it is precisely where an outbox queue slots in
 * when offline writes land in v2. Letting components call `fetch` directly is
 * what "turns v2 offline from a contained project into an archaeology dig".
 *
 * Route handlers rather than Server Actions for the same reason — serialised
 * HTTP replays into a durable queue; opaque RPC does not.
 */

export type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(
  method: RequestMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw toAppError(payload, response.status);
  }

  return payload as T;
}

/**
 * Normalises every failure into an AppError carrying the stable code, so
 * callers branch on `error.code` rather than on status numbers or prose.
 * Field-level details survive intact for React Hook Form's `setError`.
 */
function toAppError(payload: unknown, status: number): AppError {
  if (isApiError(payload)) {
    const { code, message, details } = (payload as ApiError).error;
    return new AppError(code, message, details);
  }
  return new AppError(
    status === 401 ? "UNAUTHENTICATED" : "INTERNAL",
    "Something went wrong. Please try again.",
  );
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
