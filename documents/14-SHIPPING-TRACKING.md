# Shipping & Tracking

## Shipping Policy (Flat & Free Shipping)

The store operates on a simplified flat-rate shipping model across Indonesia without requiring external courier API calculation:
- Total cart items = 1 pcs: **Rp 30.000 flat shipping**
- Total cart items >= 2 pcs: **Rp 0 (Bebas / Gratis Ongkir)**

Courier dispatch uses standard trusted couriers (J&E / JNT / SiCepat / Regular).

## Provider Independence

All shipping logic sits behind a provider adapter (`flat` provider adapter). UI consumes
normalized types.


## Normalized Rate

``` ts
type ShippingRate = {
  provider: string;
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  cost: number;
  etd?: string;
};
```

## Address Mapping

Persist normalized customer address plus provider destination ID where
useful. Do not make provider-specific IDs the only address
representation.

## Failure Handling

If shipping API fails: - show a clear retry state - do not invent a
rate - optionally allow configured manual shipping only if owner
explicitly enables it

## Shipment Admin

Operator can: - select courier/service if not inherited - input tracking
number - mark shipped - correct tracking number with audit history -
mark delivered/completed according to business rules

## Public Tracking

Website timeline uses internal status. External courier tracking is
supplemental. Do not promise real-time courier tracking unless provider
integration actually supports it.
