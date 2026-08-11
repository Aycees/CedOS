import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession, type Session } from "@/core/auth/session";
import { AppError, validationError } from "@/core/errors";

/**
 * The server half of the mutation seam.
 *
 * Wraps a route handler so that every module gets the same three things
 * without restating them: an authenticated session, a validated body, and the
 * one error contract from system design §7. A module's api.ts should contain
 * bindings, not boilerplate.
 */

type Handler<TBody, TResult> = (args: {
  session: Session;
  body: TBody;
  params: Record<string, string>;
}) => Promise<TResult>;

export function route<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  handler: Handler<z.infer<TSchema>, TResult>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    try {
      const session = await requireSession();
      const params = (await context?.params) ?? {};

      const raw =
        request.method === "GET" || request.method === "DELETE"
          ? Object.fromEntries(new URL(request.url).searchParams)
          : await request.json().catch(() => ({}));

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        throw validationError(parsed.error);
      }

      const result = await handler({ session, body: parsed.data, params });
      return result === undefined
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(result);
    } catch (error) {
      return toResponse(error);
    }
  };
}

/** For read-only handlers that take no body. */
export function readRoute<TResult>(
  handler: (args: {
    session: Session;
    params: Record<string, string>;
    searchParams: URLSearchParams;
  }) => Promise<TResult>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    try {
      const session = await requireSession();
      const params = (await context?.params) ?? {};
      const searchParams = new URL(request.url).searchParams;
      return NextResponse.json(await handler({ session, params, searchParams }));
    } catch (error) {
      return toResponse(error);
    }
  };
}

function toResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return NextResponse.json(error.toBody(), { status: error.status });
  }

  // Never leak an unexpected error's message: it can carry SQL, file paths,
  // or — in the Vault's case — data that must not reach a client.
  console.error("[route] unhandled error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}
