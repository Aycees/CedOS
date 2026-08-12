import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, isApiError, validationError, zodToDetails } from "./errors";

describe("the error contract stays one shape (system design §7)", () => {
  it("serialises to { error: { code, message } }", () => {
    const body = new AppError("NOT_FOUND", "That task could not be found.").toBody();
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "That task could not be found." },
    });
    expect(isApiError(body)).toBe(true);
  });

  it("maps each code to a stable status", () => {
    expect(new AppError("VALIDATION_ERROR", "x").status).toBe(422);
    expect(new AppError("UNAUTHENTICATED", "x").status).toBe(401);
    expect(new AppError("REFERENCED", "x").status).toBe(409);
  });
});

describe("Zod failures arrive in the shape React Hook Form consumes", () => {
  const schema = z.object({
    title: z.string().min(1, "A task needs a title."),
    bucket: z.enum(["TODAY", "SOMEDAY"]),
  });

  it("keys details by field path", () => {
    const parsed = schema.safeParse({ title: "", bucket: "LATER" });
    const details = zodToDetails(parsed.error!);

    expect(details.title).toEqual(["A task needs a title."]);
    expect(details.bucket).toHaveLength(1);
  });

  it("puts root-level issues under _root rather than dropping them", () => {
    const strict = z.object({ a: z.string() }).refine(() => false, "Nope.");
    const parsed = strict.safeParse({ a: "ok" });
    expect(zodToDetails(parsed.error!)._root).toEqual(["Nope."]);
  });

  it("wraps into a VALIDATION_ERROR carrying the details", () => {
    const parsed = schema.safeParse({ title: "", bucket: "TODAY" });
    const error = validationError(parsed.error!);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.toBody().error.details?.title).toBeDefined();
  });
});
