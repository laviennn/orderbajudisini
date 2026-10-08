import type { Metadata } from "next";
import { Checkout } from "@/features/checkout/Checkout";

export const metadata: Metadata = {
  title: "Checkout - Thrift Commerce",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <main className="section-space">
      <Checkout />
    </main>
  );
}
