import { afterEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  getShippingProvider,
  shippingConfiguration,
  quoteRates,
  searchShippingDestinations,
} from "@/server/shipping/provider";
import { shippingWeight } from "@/server/shipping/context";
import type { ShippingProvider } from "@/server/shipping/contract";
const destination = {
  province: "TEST",
  city: "TEST",
  district: "TEST",
  subdistrict: null,
  postalCode: "00000",
  providerDestinationId: null,
};
const input = { origin: destination, destination, weightGrams: 1200 };
afterEach(() => vi.unstubAllEnvs());
const adapter = (quote: ShippingProvider["quote"]): ShippingProvider => ({
  id: "test",
  testOnly: true,
  quote,
});
it("returns deterministic normalized TEST rates and bounded destination matches", async () => {
  vi.stubEnv("SHIPPING_PROVIDER", "test");
  const provider = getShippingProvider();
  const first = await quoteRates(provider, input);
  expect(await quoteRates(provider, input)).toEqual(first);
  expect(first).toEqual([
    {
      provider: "test",
      courierCode: "TEST",
      courierName: "TEST courier",
      serviceCode: "TEST-STANDARD",
      serviceName: "TEST service — not for production",
      cost: 20000,
      estimate: "TEST 2–3 days",
    },
  ]);
  expect(await searchShippingDestinations("00000")).toHaveLength(1);
  await expect(searchShippingDestinations("x")).rejects.toMatchObject({
    code: "INVALID_DESTINATION",
  });
});
it("validates destination, origin and authoritative integer weight before provider I/O", async () => {
  const quote = vi.fn(async () => []);
  await expect(
    quoteRates(adapter(quote), {
      ...input,
      destination: { ...destination, postalCode: "bad" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_DESTINATION" });
  await expect(
    quoteRates(adapter(quote), {
      ...input,
      origin: { ...destination, city: "" },
    }),
  ).rejects.toMatchObject({ code: "SHIPPING_ORIGIN_INVALID" });
  for (const weightGrams of [0, -1, 1.5, 10000001])
    await expect(
      quoteRates(adapter(quote), { ...input, weightGrams }),
    ).rejects.toMatchObject({ code: "SHIPPING_WEIGHT_INVALID" });
  expect(quote).not.toHaveBeenCalled();
  expect(shippingWeight([{ weightGrams: 500, quantity: 3 }])).toBe(1500);
  for (const weightGrams of [null, 0, 1.2])
    expect(() => shippingWeight([{ weightGrams, quantity: 1 }])).toThrow();
});
it("reports no services without substituting rates", async () => {
  await expect(
    quoteRates(
      adapter(async () => []),
      input,
    ),
  ).rejects.toMatchObject({ code: "SHIPPING_NO_SERVICES" });
});
it("normalizes vendor failures without exposing vendor messages", async () => {
  await expect(
    quoteRates(
      adapter(async () => {
        throw new Error("secret vendor payload");
      }),
      input,
    ),
  ).rejects.toMatchObject({
    code: "SHIPPING_PROVIDER_UNAVAILABLE",
    message: new AppError("SHIPPING_PROVIDER_UNAVAILABLE").message,
  });
  await expect(
    quoteRates(
      adapter(async () => {
        throw new AppError("INVALID_DESTINATION");
      }),
      input,
    ),
  ).rejects.toMatchObject({ code: "INVALID_DESTINATION" });
});
it("times out even if a provider ignores abort, and signals cancellation", async () => {
  let signal: AbortSignal | undefined;
  await expect(
    quoteRates(
      adapter(async (_input, s) => {
        signal = s;
        return new Promise(() => {});
      }),
      input,
      10,
    ),
  ).rejects.toMatchObject({ code: "SHIPPING_PROVIDER_UNAVAILABLE" });
  expect(signal?.aborted).toBe(true);
});
it("rejects malformed normalized vendor responses", async () => {
  await expect(
    quoteRates(
      adapter(async () => [{ cost: 1.5 }] as never),
      input,
    ),
  ).rejects.toMatchObject({ code: "SHIPPING_PROVIDER_UNAVAILABLE" });
});
it("fails closed in production with no provider, unknown provider or TEST provider", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const provider of ["", "unknown", "test"]) {
    vi.stubEnv("SHIPPING_PROVIDER", provider);
    vi.stubEnv("SHIPPING_API_KEY", "test-only-not-real");
    expect(shippingConfiguration().status).toBe("unavailable");
    expect(() => getShippingProvider()).toThrow(
      new AppError("SHIPPING_NOT_CONFIGURED"),
    );
  }
  await expect(
    quoteRates(
      adapter(async () => []),
      input,
    ),
  ).rejects.toMatchObject({ code: "SHIPPING_NOT_CONFIGURED" });
});
