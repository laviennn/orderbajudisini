import { validateCart } from "@/server/services/cart";
import { AppError, toApiError } from "@/lib/errors";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (Number(request.headers.get("content-length") || 0) > 8192)
      throw new AppError("VALIDATION_ERROR");
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("VALIDATION_ERROR");
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 8192) {
          await reader.cancel();
          throw new AppError("VALIDATION_ERROR");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new AppError("VALIDATION_ERROR");
    }
    return Response.json(await validateCart(input), { headers });
  } catch (error) {
    const result = toApiError(error);
    return Response.json(result, {
      status: result.code === "VALIDATION_ERROR" ? 400 : 503,
      headers,
    });
  }
}
