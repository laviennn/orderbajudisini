import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { getDatabase } from "../src/server/db";
import { seedAccessControl } from "../src/server/services/bootstrap";
config({ path: ".env.local", quiet: true });
if (
  process.env.NODE_ENV !== "development" ||
  process.env.ALLOW_DEVELOPMENT_SEED !== "true" ||
  process.env.VERCEL
) {
  console.error(
    "Development seed refused. Requires NODE_ENV=development and ALLOW_DEVELOPMENT_SEED=true, outside Vercel.",
  );
  process.exit(1);
}
try {
  await getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(73101)`);
    await seedAccessControl(tx);
  });
  console.log(
    "Development access-control seed complete. No users, credentials, products, reviews, orders, or bank details were generated.",
  );
} catch {
  console.error(
    "Development seed failed; inspect configuration and migration state.",
  );
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) await getDatabase().$client.end();
}
