import { AppError } from "@/lib/errors";

export function money(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new AppError("VALIDATION_ERROR");
  return value;
}
export const sumMoney = (values: readonly number[]) =>
  values.reduce((sum, value) => money(sum + money(value)), 0);
export const multiplyMoney = (price: number, quantity: number) =>
  money(money(price) * money(quantity));
export function formatIdr(value: number) {
  const m = money(value);
  const formatted = m.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp${formatted}`;
}
