"use client";
import type { ApiError } from "@/lib/errors";
export class AdminRequestError extends Error {
  constructor(public detail: ApiError) {
    super(detail.message);
  }
}
export async function adminRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        },
  );
  const data = await response.json();
  if (!response.ok) throw new AdminRequestError(data as ApiError);
  return data as T;
}
export function errorText(error: unknown) {
  return error instanceof AdminRequestError
    ? [
        error.message,
        ...Object.values(error.detail.fieldErrors ?? {}).flat(),
      ].join(" ")
    : "Permintaan gagal. Periksa koneksi dan coba lagi.";
}
