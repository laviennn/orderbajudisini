import "server-only";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import type { getDatabase } from ".";
export type Database = ReturnType<typeof getDatabase>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;
export async function databaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof ZodError)
      throw new AppError(
        "VALIDATION_ERROR",
        Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), [issue.message]]),
        ),
      );
    const cause =
      error && typeof error === "object" && "cause" in error
        ? error.cause
        : error;
    const code =
      cause && typeof cause === "object" && "code" in cause
        ? cause.code
        : undefined;
    if (code === "23505" || code === "40001" || code === "40P01")
      throw new AppError("CONFLICT");
    if (code === "23514" || code === "23503" || code === "23502")
      throw new AppError("VALIDATION_ERROR");
    console.error({ event: "database_operation_failed" });
    throw new AppError("PROVIDER_UNAVAILABLE");
  }
}
