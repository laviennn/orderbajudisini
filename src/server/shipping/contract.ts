import { z } from "zod";
export const destinationSchema = z
  .object({
    province: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
    district: z.string().trim().min(1).max(120),
    subdistrict: z.string().trim().min(1).max(120).nullable().default(null),
    postalCode: z.string().regex(/^[0-9]{5}$/),
    providerDestinationId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .default(null),
  })
  .strict();
export type ShippingDestination = z.infer<typeof destinationSchema>;
export const rateSchema = z
  .object({
    provider: z.string().min(1).max(80),
    courierCode: z.string().min(1).max(80),
    courierName: z.string().min(1).max(120),
    serviceCode: z.string().min(1).max(80),
    serviceName: z.string().min(1).max(120),
    cost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    estimate: z.string().min(1).max(120).nullable(),
  })
  .strict();
export type ShippingRate = z.infer<typeof rateSchema>;
export interface ShippingProvider {
  readonly id: string;
  readonly testOnly: boolean;
  quote(
    input: {
      origin: ShippingDestination;
      destination: ShippingDestination;
      weightGrams: number;
    },
    signal: AbortSignal,
  ): Promise<ShippingRate[]>;
  searchDestinations?(
    query: string,
    signal: AbortSignal,
  ): Promise<ShippingDestination[]>;
}
