import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const env = parse(readFileSync(".env.local"));

if (
  !env.R2_ACCOUNT_ID ||
  !env.R2_ACCESS_KEY_ID ||
  !env.R2_SECRET_ACCESS_KEY ||
  !env.R2_PUBLIC_BUCKET ||
  !env.R2_PRIVATE_BUCKET
) {
  console.error("Missing R2 environment variables in .env.local");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const corsRule = {
  CORSRules: [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "PUT", "HEAD", "POST"],
      AllowedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.orderbajudisini.com",
        "https://orderbajudisini.com",
        "*",
      ],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function setup() {
  for (const [label, bucket] of [
    ["Private Bucket (Payment Proofs)", env.R2_PRIVATE_BUCKET],
    ["Public Bucket (Assets & Site Media)", env.R2_PUBLIC_BUCKET],
  ]) {
    try {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: corsRule,
        }),
      );
      console.log(`R2 CORS configured successfully for ${label} (${bucket})`);
    } catch (err) {
      console.error(`Failed to configure CORS for ${label} (${bucket}):`, err);
    }
  }
}

setup().then(() => client.destroy());
