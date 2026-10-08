import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { connect } from "node:net";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../src/server/auth/password";
import { bootstrapOwner } from "../../src/server/services/bootstrap";
import { WebSocketServer } from "ws";
import { startTestDatabase } from "../integration/database";
import {
  categories,
  products,
  productImages,
  productMeasurements,
  promotions,
  reviews,
  roles,
  users,
  bankAccounts,
  storeSettings,
} from "../../src/server/db/schema";
await rm(".next/cache/fetch-cache", { recursive: true, force: true });
const database = await startTestDatabase();
await bootstrapOwner(database.db, {
  name: "TEST Browser Owner",
  email: "owner-browser@test.invalid",
  password: "TEST owner browser passphrase",
});
const [orderRole] = await database.db
  .select()
  .from(roles)
  .where(eq(roles.name, "Order Operator"));
await database.db.insert(users).values({
  name: "TEST Browser Order Operator",
  email: "order-browser@test.invalid",
  passwordHash: await hashPassword("TEST order browser passphrase"),
  roleId: orderRole!.id,
  status: "active",
});
await database.db.insert(bankAccounts).values({
  bankName: "Bank TEST",
  accountHolder: "PT TEST",
  accountNumber: "1234567890",
  active: true,
  sortOrder: 0,
});
await database.db.insert(storeSettings).values({
  id: 1,
  storeName: "TEST STORE",
  whatsappNumber: "08123456789",
  supportEmail: "support@test.invalid",
  displayAddress: "Jalan Test No. 1",
  reservationMinutes: 30,
  shippingOrigin: {
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    district: "Setiabudi",
    subdistrict: "Kuningan",
    postalCode: "12920",
    providerDestinationId: null,
  },
});
const testObjects = new Map<string, { body: Buffer; mime: string }>();
const storage = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const key = decodeURIComponent(path.slice(1));
  if (request.method === "PUT") {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 11 * 1024 * 1024) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    testObjects.set(key, {
      body: Buffer.concat(chunks),
      mime: String(request.headers["content-type"] || "image/webp"),
    });
    response.writeHead(200).end();
    return;
  }
  if (request.method === "DELETE") {
    testObjects.delete(key);
    response.writeHead(204).end();
    return;
  }
  const object = testObjects.get(key);
  if (!object) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": object.mime,
    "Content-Length": object.body.length,
  });
  response.end(request.method === "HEAD" ? undefined : object.body);
});
await new Promise<void>((resolve) =>
  storage.listen(3101, "127.0.0.1", resolve),
);
const [category] = await database.db
  .insert(categories)
  .values({ name: "TEST Kemeja", slug: "test-kemeja" })
  .returning();
const [role] = await database.db
  .insert(roles)
  .values({ name: "TEST Moderator" })
  .returning();
const [user] = await database.db
  .insert(users)
  .values({
    name: "TEST Staff",
    email: "test@example.invalid",
    roleId: role!.id,
  })
  .returning();
const rows = await database.db
  .insert(products)
  .values(
    Array.from({ length: 32 }, (_, i) => ({
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      sku: `TEST-${i + 1}`,
      name: `TEST Kemeja ${String(i + 1).padStart(2, "0")}`,
      slug: `test-kemeja-${i + 1}`,
      categoryId: category!.id,
      description:
        "TEST fixture — pakaian untuk pengujian tampilan, bukan produk toko.",
      conditionNotes: "TEST — warna sedikit pudar pada kerah.",
      defectNotes: i === 0 ? "TEST — noda kecil di bagian lengan." : null,
      sizeLabel: i % 2 ? "M" : "L",
      conditionGrade: "TEST Baik",
      price: 45000,
      weightGrams: 250,
      status:
        i === 30
          ? ("sold" as const)
          : i === 31
            ? ("draft" as const)
            : ("active" as const),
      quantity: i === 30 ? 0 : 1,
      promotionEligible: i < 9,
      publishedAt: new Date(2026, 0, 32 - i),
    })),
  )
  .returning();
await database.db.insert(promotions).values({
  name: "TEST Bundle",
  active: true,
  requiredQuantity: 3,
  bundlePrice: 100000,
  allocationStrategy: "highest_price_first",
  pricePolicy: "discount_only",
});
for (const p of rows) {
  await database.db.insert(productImages).values({
    productId: p.id,
    objectKey: `product/${p.id}.webp`,
    altText: `TEST foto ${p.name}`,
    width: 600,
    height: 800,
    bytes: 30000,
    mimeType: "image/webp",
    variant: "card",
  });
}
await database.db.insert(productImages).values({
  productId: rows[0]!.id,
  objectKey: "product/20000000-0000-4000-8000-000000000001.webp",
  altText: "TEST detail noda lengan",
  width: 600,
  height: 800,
  bytes: 30000,
  mimeType: "image/webp",
  variant: "detail",
  isDefectImage: true,
  sortOrder: 1,
});
await database.db.insert(productMeasurements).values({
  productId: rows[0]!.id,
  key: "chest_width",
  label: "Lebar dada",
  value: "56",
  unit: "cm",
});
await database.db.insert(reviews).values([
  {
    productId: rows[0]!.id,
    reviewerName: "TEST Pembeli",
    rating: 4,
    body: "TEST Ulasan disetujui.",
    status: "approved",
    moderatedBy: user!.id,
    moderatedAt: new Date(),
  },
  {
    productId: rows[0]!.id,
    reviewerName: "TEST Pending",
    rating: 1,
    body: "TEST Ulasan rahasia.",
    status: "pending",
  },
]);
const proxy = new WebSocketServer({ host: "127.0.0.1", port: 0 });
await new Promise<void>((resolve) => proxy.on("listening", resolve));
proxy.on("connection", (ws) => {
  const socket = connect({
    host: "127.0.0.1",
    port: database.pool.options.port!,
  });
  ws.on("message", (data) =>
    socket.write(
      Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer),
    ),
  );
  socket.on("data", (data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  socket.on("error", () => ws.close());
  ws.on("error", () => socket.destroy());
  ws.on("close", () => socket.destroy());
  socket.on("close", () => ws.close());
});
const address = proxy.address();
if (!address || typeof address === "string") throw new Error("Invalid proxy");
const password = database.pool.options.password;
if (typeof password !== "string") throw new Error("Invalid test credential");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: `postgresql://test_runner:${password}@127.0.0.1:${database.pool.options.port}/postgres`,
  AUTH_ENABLED: "true",
  AUTH_TRUST_HOST: "true",
  TEST_STORAGE_URL: "http://127.0.0.1:3101",
  AUTH_SECRET: "isolated-browser-test-secret-at-least-32-characters",
  R2_ACCOUNT_ID: "a".repeat(32),
  R2_ACCESS_KEY_ID: "test-only",
  R2_SECRET_ACCESS_KEY: "test-only",
  R2_PUBLIC_BUCKET: "test-public",
  R2_PRIVATE_BUCKET: "test-private",
  R2_PUBLIC_BASE_URL: "https://media.example.invalid",
  SHIPPING_PROVIDER: "test",
  TEST_WS_PROXY: `127.0.0.1:${address.port}`,
  NODE_OPTIONS: "--import ./tests/e2e/neon-proxy.mjs",
};
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { env, stdio: "inherit" },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  for (const client of proxy.clients) client.terminate();
  proxy.close();
  storage.close();
  await database.stop();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
child.on("exit", () => void stop());
