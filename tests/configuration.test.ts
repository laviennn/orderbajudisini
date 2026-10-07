import { describe, expect, it } from "vitest";
import { configurationState, parseEnvironment } from "@/lib/env-schema";
import { AppError, toApiError } from "@/lib/errors";

describe("configuration boundaries", () => {
  it("allows a credential-free foundation without claiming a connected database", () => {
    const env = parseEnvironment({ DATABASE_URL: "", AUTH_SECRET: "" });
    expect(configurationState(env, ["DATABASE_URL"])).toEqual({
      status: "unavailable",
      missing: ["DATABASE_URL"],
    });
  });
  it("rejects malformed configuration without leaking its value", () => {
    expect(() =>
      parseEnvironment({ DATABASE_URL: "secret-connection" }),
    ).toThrow("DATABASE_URL");
    try {
      parseEnvironment({ DATABASE_URL: "secret-connection" });
    } catch (error) {
      expect(String(error)).not.toContain("secret-connection");
    }
  });
  it("rejects unsafe URLs, weak auth secrets and shared storage buckets", () => {
    for (const input of [
      { APP_URL: "javascript:alert(1)" },
      { R2_PUBLIC_BASE_URL: "https://user:password@example.com" },
      { R2_PUBLIC_BASE_URL: "http://media.example.com" },
      { AUTH_SECRET: "short" },
      { R2_PUBLIC_BUCKET: "same-bucket", R2_PRIVATE_BUCKET: "same-bucket" },
    ])
      expect(() => parseEnvironment(input)).toThrow();
  });
  it("marks partial provider configuration as unavailable", () => {
    expect(
      configurationState(
        parseEnvironment({ R2_PUBLIC_BUCKET: "public-media" }),
        ["R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET"],
      ).status,
    ).toBe("unavailable");
  });
  it("normalizes unknown SQL/provider exceptions", () => {
    expect(
      toApiError(new Error("postgres://private-secret"), "request-1"),
    ).toEqual({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan. Coba lagi nanti.",
      requestId: "request-1",
    });
    expect(toApiError(new AppError("FORBIDDEN")).code).toBe("FORBIDDEN");
  });
});
