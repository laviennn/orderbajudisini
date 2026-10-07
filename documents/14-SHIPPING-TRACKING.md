# Shipping & Tracking

## Provider Independence

All external shipping logic sits behind a provider adapter. UI consumes
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
