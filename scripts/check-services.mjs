import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Read-only checks. Never print credentials, connection strings, or object names.
const env = parse(readFileSync(".env.local"));
let failed = false;
try {
  const sql = neon(env.DATABASE_URL);
  await sql`select 1 as connected`;
  console.log("Neon: connection succeeded.");
} catch {
  console.log("Neon: connection failed; check credentials and network access.");
  failed = true;
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 1,
});
for (const [label, bucket] of [
  ["Product bucket", env.R2_PUBLIC_BUCKET],
  ["Payment proof bucket", env.R2_PRIVATE_BUCKET],
]) {
  try {
    await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }),
      { abortSignal: AbortSignal.timeout(15_000) },
    );
    console.log(`R2 ${label}: authenticated read succeeded.`);
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    console.log(
      `R2 ${label}: read failed${typeof status === "number" ? ` (HTTP ${status})` : ""}.`,
    );
    failed = true;
  }
}
client.destroy();
process.exitCode = failed ? 1 : 0;
