import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import type { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import * as schema from "@/server/db/schema";
export async function startTestDatabase() {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  if (!address || typeof address === "string")
    throw new Error("No test port available");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  const directory = await mkdtemp(join(tmpdir(), "orderbajudisini-phase1a-"));
  const password = randomBytes(24).toString("hex");
  const postgres = new EmbeddedPostgres({
    databaseDir: directory,
    user: "test_runner",
    password,
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  const pool = new Pool({
    host: "127.0.0.1",
    port,
    user: "test_runner",
    password,
    database: "postgres",
    max: 10,
  });
  // pg-pool.end() resolves after requesting socket closure; wait for client end events
  // before stopping PostgreSQL so teardown cannot terminate a still-closing connection.
  const disconnected: Promise<void>[] = [];
  pool.on("connect", (client) => {
    disconnected.push(
      new Promise<void>((resolve) => client.once("end", resolve)),
    );
  });
  async function closePool() {
    await pool.end();
    await Promise.all(disconnected);
  }
  // Neon Pool implements the node-postgres query contract. This test-only adapter uses the
  // identical production Drizzle dialect against a real, isolated local PostgreSQL server.
  const db = drizzle({ client: pool as unknown as NeonPool, schema });
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } catch (error) {
    await closePool();
    await postgres.stop();
    throw error;
  }
  return {
    db,
    pool,
    stop: async () => {
      await closePool();
      await postgres.stop();
    },
  };
}
