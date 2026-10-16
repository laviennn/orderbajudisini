import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../src/server/db";
import { users } from "../src/server/db/schema/identity";
import { hashPassword, passwordSchema } from "../src/server/auth/password";
import { toApiError } from "../src/lib/errors";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

let hidden = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  },
});

async function promptCredentials() {
  if (!process.stdin.isTTY) {
    throw new Error(
      "A terminal is required for interactive input, or pass arguments: <email> <password>",
    );
  }
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const email = await rl.question("User email: ");
    process.stdout.write("New password (15–128 characters; hidden): ");
    hidden = true;
    const password = await rl.question("");
    hidden = false;
    process.stdout.write("\nConfirm new password (hidden): ");
    hidden = true;
    const confirmation = await rl.question("");
    hidden = false;
    process.stdout.write("\n");
    if (password !== confirmation) {
      throw new Error("Password confirmation differs.");
    }
    return { email: email.trim().toLowerCase(), password };
  } finally {
    hidden = false;
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let email = "";
  let password = "";

  const arg0 = args[0];
  const arg1 = args[1];

  if (arg0 && arg1) {
    email = arg0.trim().toLowerCase();
    password = arg1;
  } else if (arg0) {
    email = arg0.trim().toLowerCase();
    const creds = await promptCredentials();
    password = creds.password;
  } else {
    const creds = await promptCredentials();
    email = creds.email;
    password = creds.password;
  }

  passwordSchema.parse(password);

  const db = getDatabase();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new Error(`User with email "${email}" not found.`);
  }

  const newHash = await hashPassword(password);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(
    `\nPassword successfully updated for ${user.name} (${user.email})!`,
  );
}

try {
  await main();
} catch (error) {
  console.error("\nError:", toApiError(error).message);
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) {
    await getDatabase().$client.end();
  }
}
