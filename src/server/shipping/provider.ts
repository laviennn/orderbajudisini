import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getEnvironment } from "@/server/env";
import {
  destinationSchema,
  rateSchema,
  type ShippingProvider,
} from "./contract";
import { rajaOngkirStarterProvider } from "./rajaongkir";

export function shippingConfiguration() {
  const env = getEnvironment();
  if (!env.SHIPPING_PROVIDER)
    return { status: "unavailable", reason: "not_configured" } as const;
  if (env.SHIPPING_PROVIDER === "RAJAONGKIR")
    return { status: "active", provider: "RAJAONGKIR" } as const;
  if (env.SHIPPING_PROVIDER === "test" && env.NODE_ENV !== "production")
    return { status: "test", provider: "test" } as const;
  return {
    status: "unavailable",
    reason:
      env.SHIPPING_PROVIDER === "test"
        ? "test_forbidden"
        : "adapter_not_implemented",
  } as const;
}
export function assertProviderAllowed(provider: ShippingProvider) {
  if (
    getEnvironment().NODE_ENV === "production" &&
    (provider.testOnly || provider.id === "test")
  )
    throw new AppError("SHIPPING_NOT_CONFIGURED");
}
const testProvider: ShippingProvider = {
  id: "test",
  testOnly: true,
  async quote({ weightGrams }) {
    // Isolated deterministic fixtures, NEVER market rates or a production fallback.
    return [
      {
        provider: "test",
        courierCode: "TEST",
        courierName: "TEST courier",
        serviceCode: "TEST-STANDARD",
        serviceName: "TEST service — not for production",
        cost: 10000 * Math.ceil(weightGrams / 1000),
        estimate: "TEST 2–3 days",
      },
    ];
  },
  async searchDestinations(query) {
    return ["00000", "00001"]
      .map((postalCode) => ({
        province: "TEST",
        city: "TEST",
        district: "TEST",
        subdistrict: null,
        postalCode,
        providerDestinationId: `TEST-${postalCode}`,
      }))
      .filter((d) =>
        `${d.city} ${d.postalCode}`.toLowerCase().includes(query.toLowerCase()),
      );
  },
};
export function getShippingProvider(): ShippingProvider {
  const config = shippingConfiguration();
  if (config.status === "active" && config.provider === "RAJAONGKIR") {
    return rajaOngkirStarterProvider;
  }
  if (config.status !== "test") throw new AppError("SHIPPING_NOT_CONFIGURED");
  assertProviderAllowed(testProvider);
  return testProvider;
}
export async function providerOperation<T>(
  provider: ShippingProvider,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 5000,
): Promise<T> {
  assertProviderAllowed(provider);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AppError("SHIPPING_PROVIDER_UNAVAILABLE"));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_DESTINATION")
      throw error;
    throw new AppError("SHIPPING_PROVIDER_UNAVAILABLE");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function quoteRates(
  provider: ShippingProvider,
  input: Parameters<ShippingProvider["quote"]>[0],
  timeoutMs?: number,
) {
  const origin = destinationSchema.safeParse(input.origin);
  const destination = destinationSchema.safeParse(input.destination);
  if (!origin.success) throw new AppError("SHIPPING_ORIGIN_INVALID");
  if (!destination.success) throw new AppError("INVALID_DESTINATION");
  if (
    !Number.isSafeInteger(input.weightGrams) ||
    input.weightGrams < 1 ||
    input.weightGrams > 10000000
  )
    throw new AppError("SHIPPING_WEIGHT_INVALID");
  const rates = await providerOperation(
    provider,
    async (signal) => {
      const result = z
        .array(rateSchema)
        .max(50)
        .parse(
          await provider.quote(
            {
              weightGrams: input.weightGrams,
              origin: origin.data,
              destination: destination.data,
            },
            signal,
          ),
        );
      if (
        result.some((r) => r.provider !== provider.id) ||
        new Set(result.map((r) => `${r.courierCode}:${r.serviceCode}`)).size !==
          result.length
      )
        throw new Error("Invalid normalized rates");
      return result;
    },
    timeoutMs,
  );
  if (!rates.length) throw new AppError("SHIPPING_NO_SERVICES");
  return rates;
}
export async function searchShippingDestinations(
  query: string,
  provider = getShippingProvider(),
) {
  if (!z.string().trim().min(2).max(120).safeParse(query).success)
    throw new AppError("INVALID_DESTINATION");
  if (!provider.searchDestinations) throw new AppError("INVALID_DESTINATION");
  return providerOperation(provider, async (signal) =>
    z
      .array(destinationSchema)
      .max(20)
      .parse(await provider.searchDestinations!(query.trim(), signal)),
  );
}
