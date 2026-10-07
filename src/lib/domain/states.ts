export const productStates = [
  "draft",
  "active",
  "reserved",
  "sold",
  "archived",
] as const;
export const orderStates = [
  "pending_payment",
  "payment_submitted",
  "payment_verified",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "expired",
] as const;
export const paymentStates = [
  "pending",
  "submitted",
  "verified",
  "rejected",
] as const;
export const reviewStates = ["pending", "approved", "rejected"] as const;
export const userStates = ["active", "inactive"] as const;
export type OrderState = (typeof orderStates)[number];
export type PaymentState = (typeof paymentStates)[number];

const orderTransitions: Record<OrderState, readonly OrderState[]> = {
  pending_payment: ["payment_submitted", "cancelled", "expired"],
  payment_submitted: ["payment_verified", "pending_payment", "cancelled"],
  payment_verified: ["processing"],
  processing: ["shipped"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
  expired: [],
};
const paymentTransitions: Record<PaymentState, readonly PaymentState[]> = {
  pending: ["submitted"],
  submitted: ["verified", "rejected"],
  verified: [],
  rejected: ["submitted"],
};
export const canTransitionOrder = (from: OrderState, to: OrderState) =>
  orderTransitions[from].includes(to);
export const canTransitionPayment = (from: PaymentState, to: PaymentState) =>
  paymentTransitions[from].includes(to);
