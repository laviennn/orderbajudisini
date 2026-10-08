export type CommerceEvent =
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "begin_checkout"
  | "add_shipping_info"
  | "order_created";
export function trackCommerce(event: CommerceEvent, ids: readonly string[]) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_GTM_ID) return;
  const target = window as Window & { dataLayer?: unknown[] };
  target.dataLayer ??= [];
  // Fixed allowlist: no names, search strings, URLs, contact fields or tokens.
  target.dataLayer.push({
    event,
    ecommerce: {
      currency: "IDR",
      items: ids.slice(0, 100).map((id) => ({ item_id: id })),
    },
  });
}
