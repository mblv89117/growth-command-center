import type { ZodSchema } from "zod";
import { ValidationError } from "@/lib/api/errors";

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid request body", parsed.error.flatten());
  }

  return parsed.data;
}
