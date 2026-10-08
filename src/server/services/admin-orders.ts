import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import {
  orders,
  orderItems,
  shipments,
  orderStatusHistory,
  auditLogs,
} from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";

export interface GetOrdersOptions {
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getAdminOrders(options: GetOrdersOptions = {}) {
  return withStaff("orders.read", async (tx) => {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    let whereClause = undefined;
    if (options.status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      whereClause = eq(orders.status, options.status as any);
    }

    const items = await tx
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        status: orders.status,
        addressSnapshot: orders.addressSnapshot,
        grandTotal: orders.grandTotal,
        shippingCourier: orders.shippingCourier,
        shippingService: orders.shippingService,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countQuery = tx
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);
    const countResult = await countQuery;
    const count = countResult[0]?.count ?? 0;

    return {
      items,
      total: Number(count),
      page,
      pageSize,
    };
  });
}

export async function getAdminOrderDetail(orderId: string) {
  return withStaff("orders.read", async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) throw new AppError("NOT_FOUND");

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, order.id))
      .limit(1);

    return {
      order,
      orderItems: items,
      shipment: shipment || null,
    };
  });
}

export async function processOrder(orderId: string) {
  return withStaff("orders.update", async (tx, actor) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "payment_verified") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    const [updatedOrder] = await tx
      .update(orders)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: "payment_verified",
      toStatus: "processing",
      actorUserId: actor.id,
    });

    await tx.insert(shipments).values({
      orderId,
      courier: order.shippingCourier,
      service: order.shippingService,
      status: "pending",
      updatedBy: actor.id,
    });

    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "order.process",
      entityType: "order",
      entityId: orderId,
      metadata: { from: "payment_verified", to: "processing" },
    });

    return updatedOrder;
  });
}

export interface ShipOrderData {
  courier: string;
  service: string;
  trackingNumber: string;
  shippedAt?: Date;
  note?: string;
}

export async function shipOrder(orderId: string, data: ShipOrderData) {
  return withStaff("shipments.update", async (tx, actor) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "processing") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .for("update")
      .limit(1);

    if (!shipment) throw new AppError("NOT_FOUND");
    if (shipment.status !== "pending") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    if (!data.trackingNumber || data.trackingNumber.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR");
    }

    const shippedAt = data.shippedAt || new Date();

    const [updatedOrder] = await tx
      .update(orders)
      .set({ status: "shipped", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await tx
      .update(shipments)
      .set({
        courier: data.courier,
        service: data.service,
        trackingNumber: data.trackingNumber,
        shippedAt,
        status: "shipped",
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(shipments.id, shipment.id));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: "processing",
      toStatus: "shipped",
      actorUserId: actor.id,
      note: data.note,
    });

    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "order.ship",
      entityType: "order",
      entityId: orderId,
      metadata: {
        from: "processing",
        to: "shipped",
        trackingNumber: data.trackingNumber,
        courier: data.courier,
        service: data.service,
      },
    });

    return updatedOrder;
  });
}

export async function completeOrder(orderId: string) {
  return withStaff("orders.update", async (tx, actor) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "shipped") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .for("update")
      .limit(1);

    if (!shipment) throw new AppError("NOT_FOUND");

    const [updatedOrder] = await tx
      .update(orders)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await tx
      .update(shipments)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(shipments.id, shipment.id));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: "shipped",
      toStatus: "completed",
      actorUserId: actor.id,
    });

    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "order.complete",
      entityType: "order",
      entityId: orderId,
      metadata: { from: "shipped", to: "completed" },
    });

    return updatedOrder;
  });
}
