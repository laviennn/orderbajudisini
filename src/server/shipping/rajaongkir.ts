import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getEnvironment } from "@/server/env";
import type { ShippingProvider, ShippingRate } from "./contract";

const RAJAONGKIR_STARTER_BASE = "https://api.rajaongkir.com/starter";

const citySchema = z.object({
  city_id: z.string(),
  province: z.string(),
  type: z.string(),
  city_name: z.string(),
  postal_code: z.string(),
});

const responseSchema = z.object({
  rajaongkir: z.object({
    status: z.object({
      code: z.number(),
      description: z.string(),
    }),
    results: z.any(),
  }),
});

let cachedCities: z.infer<typeof citySchema>[] | null = null;

async function getCities(signal: AbortSignal) {
  if (cachedCities) return cachedCities;
  const env = getEnvironment();
  const apiKey = env.SHIPPING_API_KEY;
  if (!apiKey) throw new AppError("SHIPPING_NOT_CONFIGURED");

  const res = await fetch(`${RAJAONGKIR_STARTER_BASE}/city`, {
    headers: { key: apiKey },
    signal,
    next: { revalidate: 86400 },
  });

  if (!res.ok) throw new AppError("SHIPPING_PROVIDER_UNAVAILABLE");
  
  const json = await res.json();
  const data = responseSchema.parse(json);
  
  if (data.rajaongkir.status.code !== 200) {
    throw new AppError("SHIPPING_PROVIDER_UNAVAILABLE");
  }
  
  cachedCities = z.array(citySchema).parse(data.rajaongkir.results);
  return cachedCities;
}

export const rajaOngkirStarterProvider: ShippingProvider = {
  id: "RAJAONGKIR",
  testOnly: false,
  async searchDestinations(query, signal) {
    const cities = await getCities(signal);
    const lowerQuery = query.toLowerCase();
    
    return cities
      .filter(
        (c) =>
          c.city_name.toLowerCase().includes(lowerQuery) ||
          c.province.toLowerCase().includes(lowerQuery) ||
          c.postal_code.includes(lowerQuery)
      )
      .slice(0, 20)
      .map((c) => ({
        province: c.province,
        city: `${c.type} ${c.city_name}`,
        district: "",
        subdistrict: null,
        postalCode: c.postal_code,
        providerDestinationId: c.city_id,
      }));
  },
  async quote({ origin, destination, weightGrams }, signal) {
    if (!origin.providerDestinationId || !destination.providerDestinationId) {
      throw new AppError("INVALID_DESTINATION");
    }

    const env = getEnvironment();
    const apiKey = env.SHIPPING_API_KEY;
    if (!apiKey) throw new AppError("SHIPPING_NOT_CONFIGURED");

    const couriers = ["jne", "pos", "tiki"];
    const rates: ShippingRate[] = [];

    const promises = couriers.map(async (courier) => {
      try {
        const res = await fetch(`${RAJAONGKIR_STARTER_BASE}/cost`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            key: apiKey,
          },
          body: new URLSearchParams({
            origin: origin.providerDestinationId!,
            destination: destination.providerDestinationId!,
            weight: weightGrams.toString(),
            courier,
          }),
          signal,
        });

        if (!res.ok) return;
        const json = await res.json();
        const data = responseSchema.parse(json);

        if (data.rajaongkir.status.code === 200) {
          const results = data.rajaongkir.results;
          if (Array.isArray(results) && results.length > 0) {
            const result = results[0];
            const courierCode = result.code.toUpperCase();
            const courierName = result.name;

            for (const service of result.costs) {
              for (const cost of service.cost) {
                rates.push({
                  provider: "RAJAONGKIR",
                  courierCode,
                  courierName,
                  serviceCode: service.service,
                  serviceName: service.description,
                  cost: cost.value,
                  estimate: cost.etd ? `${cost.etd} hari` : null,
                });
              }
            }
          }
        }
      } catch {
        // Ignore single courier failure, others might succeed
      }
    });

    await Promise.all(promises);
    return rates;
  },
};
