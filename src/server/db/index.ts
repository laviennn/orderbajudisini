import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { AppError } from "@/lib/errors";
import { getEnvironment } from "@/server/env";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", () => console.error({ event: "database_pool_error" }));
  return drizzle({ client: pool, schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

// WebSocket Pool supports the interactive transactions required by checkout.
export function getDatabase() {
  const { DATABASE_URL } = getEnvironment();
  if (!DATABASE_URL) throw new AppError("NOT_CONFIGURED");
  database ??= createDatabase(DATABASE_URL);
  return database;
}
