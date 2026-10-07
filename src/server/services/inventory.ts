import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { products, reservations } from "@/server/db/schema";
import type { Transaction } from "@/server/db/operations";
export async function reserveLockedProducts(
  tx: Transaction,
  orderId: string,
  items: { productId: string; quantity: number }[],
  expiresAt: Date,
) {
  for (const item of [...items].sort((a, b) =>
    a.productId.localeCompare(b.productId),
  )) {
    const changed = await tx
      .update(products)
      .set({
        quantity: sql`${products.quantity} - ${item.quantity}`,
        status: sql`case when ${products.quantity} = ${item.quantity} then 'reserved'::product_status else 'active'::product_status end`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, item.productId),
          eq(products.status, "active"),
          sql`${products.quantity} >= ${item.quantity}`,
        ),
      )
      .returning({ id: products.id });
    if (!changed.length) throw new AppError("PRODUCT_UNAVAILABLE");
    await tx.insert(reservations).values({
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      expiresAt,
    });
  }
}
// Caller holds the order row lock. Lock every product in the same UUID order across transactions.
export async function finishReservations(
  tx: Transaction,
  orderId: string,
  outcome: "released" | "sold",
) {
  const entries = await tx
    .select()
    .from(reservations)
    .where(eq(reservations.orderId, orderId))
    .orderBy(asc(reservations.productId))
    .for("update");
  if (!entries.length) throw new AppError("PRODUCT_UNAVAILABLE");
  await tx
    .select({ id: products.id })
    .from(products)
    .where(
      inArray(
        products.id,
        entries.map((r) => r.productId),
      ),
    )
    .orderBy(asc(products.id))
    .for("update");
  for (const entry of entries) {
    if (entry.status === outcome) continue;
    if (entry.status !== "reserved") throw new AppError("PRODUCT_UNAVAILABLE");
    await tx
      .update(reservations)
      .set({ status: outcome, updatedAt: new Date() })
      .where(eq(reservations.id, entry.id));
    if (outcome === "released") {
      await tx
        .update(products)
        .set({
          quantity: sql`${products.quantity} + ${entry.quantity}`,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(products.id, entry.productId));
    } else {
      const outstanding = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(
          and(
            eq(reservations.productId, entry.productId),
            eq(reservations.status, "reserved"),
          ),
        )
        .limit(1);
      if (!outstanding.length)
        await tx
          .update(products)
          .set({ status: "sold", updatedAt: new Date() })
          .where(
            and(eq(products.id, entry.productId), eq(products.quantity, 0)),
          );
    }
  }
}
