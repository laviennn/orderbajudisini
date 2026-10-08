import { beforeEach, describe, expect, it, vi } from "vitest";
import { createObjectKey, uploadSchema } from "@/server/storage/policy";
import { getStorage, storageConfiguration } from "@/server/storage/r2";

const id = "cb76a25f-3a36-4cd8-9452-9a583593376d";

describe("R2 boundary", () => {
  beforeEach(() => {
    vi.stubEnv("R2_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("R2_ACCESS_KEY_ID", "isolated-test-access");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "isolated-test-secret");
    vi.stubEnv("R2_PUBLIC_BUCKET", "test-public");
    vi.stubEnv("R2_PRIVATE_BUCKET", "test-private");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.test");
  });
  it("does not fabricate availability when a credential is absent", () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    expect(storageConfiguration().status).toBe("unavailable");
    expect(getStorage).toThrow();
  });
  it("rejects unsupported MIME types and excessive or fractional sizes", () => {
    for (const input of [
      { purpose: "payment-proof", mime: "text/html", bytes: 1 },
      { purpose: "product", mime: "image/png", bytes: 11 * 1024 * 1024 },
      { purpose: "product", mime: "image/png", bytes: 0.5 },
    ])
      expect(uploadSchema.safeParse(input).success).toBe(false);
  });
  it("never resolves proofs or traversal as public media", () => {
    const storage = getStorage();
    const proof = createObjectKey(
      { purpose: "payment-proof", mime: "image/jpeg", bytes: 100 },
      id,
    );
    expect(() => storage.publicMediaUrl(proof)).toThrow();
    expect(() => storage.publicMediaUrl("product/../private")).toThrow();
    expect(storage.publicMediaUrl(`product/${id}.jpg`)).toBe(
      `https://media.example.test/product/${id}.jpg`,
    );
    expect(storage.publicMediaUrl(`site-media/${id}.png`)).toBe(
      `https://media.example.test/site-media/${id}.png`,
    );
  });
  it("signs uploads for the correct bucket with short expiry and bounded metadata", async () => {
    for (const purpose of ["product", "payment-proof"] as const) {
      const result = await getStorage().createUpload({
        purpose,
        mime: "image/png",
        bytes: 123,
      });
      const url = new URL(result.url);
      expect(url.hostname).toContain(
        purpose === "product" ? "test-public" : "test-private",
      );
      expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
        "content-type",
      );
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
        "content-length",
      );
      expect(result.key.startsWith(`${purpose}/`)).toBe(true);
    }
  });
  it("only signs private proof downloads, with no-store and attachment disposition", async () => {
    const storage = getStorage();
    await expect(
      storage.privateProofUrl(`product/${id}.jpg`),
    ).rejects.toThrow();
    const { url: signed } = await storage.privateProofUrl(
      `payment-proof/${id}.jpg`,
    );
    const url = new URL(signed);
    expect(url.hostname).toContain("test-private");
    expect(url.searchParams.get("response-cache-control")).toBe(
      "private, no-store",
    );
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment",
    );
  });
});
