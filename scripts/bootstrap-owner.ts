import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { getDatabase } from "../src/server/db";
import { bootstrapOwner } from "../src/server/services/bootstrap";
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
async function readCredentials() {
  if (!process.stdin.isTTY)
    throw new Error("A terminal is required for hidden password entry.");
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const name = await rl.question("Owner name: ");
    const email = await rl.question("Owner email: ");
    process.stdout.write("Password (15–128 characters; hidden): ");
    hidden = true;
    const password = await rl.question("");
    hidden = false;
    process.stdout.write("\n");
    process.stdout.write("Confirm password (hidden): ");
    hidden = true;
    const confirmation = await rl.question("");
    hidden = false;
    process.stdout.write("\n");
    if (password !== confirmation)
      throw new Error("Password confirmation differs.");
    return { name, email, password };
  } finally {
    hidden = false;
    rl.close();
  }
}
try {
  const credentials = await readCredentials();
  await bootstrapOwner(getDatabase(), credentials);
  console.log(
    "First owner created. Set AUTH_ENABLED=true only after reviewing the deployment checklist.",
  );
} catch (error) {
  console.error(toApiError(error).message);
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) await getDatabase().$client.end();
}
