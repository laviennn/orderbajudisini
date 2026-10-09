import "server-only";
import { ZodError } from "zod";
import { AppError, toApiError } from "@/lib/errors";
export async function adminResponse(
  request: Request,
  operation: (body: unknown) => Promise<unknown>,
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    let input: unknown = null;
    if (request.method !== "GET") {
      // Next may reconstruct request.url with an internal hostname behind its server.
      // Compare to the browser Host header; browsers cannot override it in cross-site fetches.
      const protocol =
        request.headers.get("x-forwarded-proto") ??
        new URL(request.url).protocol.slice(0, -1);
      const host = request.headers.get("host");
      if (
        !host ||
        !["http", "https"].includes(protocol) ||
        request.headers.get("origin") !== `${protocol}://${host}`
      )
        throw new AppError("FORBIDDEN");
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new AppError("VALIDATION_ERROR");
      const reader = request.body?.getReader();
      if (!reader) throw new AppError("VALIDATION_ERROR");
      let size = 0;
      let text = "";
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 131072) {
            await reader.cancel();
            throw new AppError("VALIDATION_ERROR");
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      try {
        input = JSON.parse(text);
      } catch {
        throw new AppError("VALIDATION_ERROR");
      }
    }
    return Response.json(await operation(input), { headers });
  } catch (error) {
    const result = toApiError(
      error instanceof ZodError ? new AppError("VALIDATION_ERROR") : error,
    );
    const statuses: Partial<Record<string, number>> = {
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INVALID_ORDER_TRANSITION: 409,
      INVALID_PAYMENT_TRANSITION: 409,
      PAYMENT_ALREADY_VERIFIED: 409,
      LAST_OWNER: 409,
      PRODUCT_UNAVAILABLE: 409,
      VALIDATION_ERROR: 400,
    };
    const status = statuses[result.code] ?? 503;
    return Response.json(result, { status, headers });
  }
}
