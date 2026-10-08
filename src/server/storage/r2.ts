import "server-only";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/errors";
import { configurationState } from "@/lib/env-schema";
import { getEnvironment } from "@/server/env";
import {
  assertObjectKey,
  createObjectKey,
  uploadSchema,
  type StoragePurpose,
  type UploadInput,
} from "./policy";

const signedLifetimeSeconds = 120;

export interface StorageAdapter {
  createUpload(input: UploadInput): Promise<{
    key: string;
    url: string;
    expiresIn: number;
    headers: Record<string, string>;
  }>;
  inspectObject(
    purpose: StoragePurpose,
    key: string,
  ): Promise<{ bytes: number; mime: string }>;
  privateProofUrl(key: string): Promise<{ url: string; expiresIn: number }>;
  publicMediaUrl(key: string): string;
  readProductSource(key: string, maximumBytes: number): Promise<Buffer>;
  readPaymentProof(key: string, maximumBytes: number): Promise<Buffer>;
  writeProductVariant(key: string, body: Buffer): Promise<void>;
  deleteObject(purpose: StoragePurpose, key: string): Promise<void>;
}

export function storageConfiguration() {
  return configurationState(getEnvironment(), [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_PUBLIC_BUCKET",
    "R2_PRIVATE_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ]);
}

export function getStorage(): StorageAdapter {
  const env = getEnvironment();
  const {
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_PUBLIC_BUCKET: publicBucket,
    R2_PRIVATE_BUCKET: privateBucket,
    R2_PUBLIC_BASE_URL: baseUrl,
  } = env;
  if (
    !account ||
    !accessKeyId ||
    !secretAccessKey ||
    !publicBucket ||
    !privateBucket ||
    !baseUrl
  ) {
    throw new AppError("NOT_CONFIGURED");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.TEST_STORAGE_URL || `https://${account}.r2.cloudflarestorage.com`,
    forcePathStyle: !!process.env.TEST_STORAGE_URL,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
  });
  const bucket = (purpose: StoragePurpose) =>
    (purpose === "product" || purpose === "site-media") ? publicBucket : privateBucket;

  async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      console.error({ event: "storage_operation_failed" });
      throw new AppError("PROVIDER_UNAVAILABLE");
    }
  }

  // Internal infrastructure only: callers MUST authorize before signing. Product upload routes enforce these permissions before calling this adapter.
  return {
    async readProductSource(key, maximumBytes) {
      assertObjectKey(key, "product-source");
      return providerCall(async () => {
        const object = await client.send(
          new GetObjectCommand({ Bucket: privateBucket, Key: key }),
        );
        if (
          !object.Body ||
          !object.ContentLength ||
          object.ContentLength > maximumBytes
        )
          throw new AppError("VALIDATION_ERROR");
        const chunks: Uint8Array[] = [];
        let length = 0;
        for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
          length += chunk.byteLength;
          if (length > maximumBytes) throw new AppError("VALIDATION_ERROR");
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      });
    },
    async readPaymentProof(key, maximumBytes) {
      assertObjectKey(key, "payment-proof");
      return providerCall(async () => {
        const object = await client.send(
          new GetObjectCommand({ Bucket: privateBucket, Key: key }),
        );
        if (
          !object.Body ||
          !object.ContentLength ||
          object.ContentLength > maximumBytes
        )
          throw new AppError("VALIDATION_ERROR");
        const chunks: Uint8Array[] = [];
        let length = 0;
        for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
          length += chunk.byteLength;
          if (length > maximumBytes) throw new AppError("VALIDATION_ERROR");
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      });
    },
    async writeProductVariant(key, body) {
      assertObjectKey(key, "product");
      await providerCall(() =>
        client.send(
          new PutObjectCommand({
            Bucket: publicBucket,
            Key: key,
            Body: body,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        ),
      );
    },
    async deleteObject(purpose, key) {
      assertObjectKey(key, purpose);
      await providerCall(() =>
        client.send(
          new DeleteObjectCommand({ Bucket: bucket(purpose), Key: key }),
        ),
      );
    },
    async createUpload(input) {
      if (!uploadSchema.safeParse(input).success)
        throw new AppError("VALIDATION_ERROR");
      const key = createObjectKey(input, randomUUID());
      const url = await providerCall(() =>
        getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket(input.purpose),
            Key: key,
            ContentType: input.mime,
            ContentLength: input.bytes,
          }),
          {
            expiresIn: signedLifetimeSeconds,
            signableHeaders: new Set(["content-type", "content-length"]),
          },
        ),
      );
      return {
        key,
        url,
        expiresIn: signedLifetimeSeconds,
        headers: { "Content-Type": input.mime },
      };
    },
    async inspectObject(purpose, key) {
      assertObjectKey(key, purpose);
      const object = await providerCall(() =>
        client.send(
          new HeadObjectCommand({ Bucket: bucket(purpose), Key: key }),
        ),
      );
      if (!object.ContentType || object.ContentLength === undefined)
        throw new AppError("VALIDATION_ERROR");
      // Metadata inspection alone does not prove actual file content; product acceptance also decodes actual bytes in admin-media.
      return { bytes: object.ContentLength, mime: object.ContentType };
    },
    async privateProofUrl(key) {
      assertObjectKey(key, "payment-proof");
      const url = await providerCall(() =>
        getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: privateBucket,
            Key: key,
            ResponseCacheControl: "private, no-store",
            ResponseContentDisposition: "attachment",
          }),
          { expiresIn: signedLifetimeSeconds },
        ),
      );
      return { url, expiresIn: signedLifetimeSeconds };
    },
    publicMediaUrl(key) {
      if (key.startsWith("site-media/")) {
        assertObjectKey(key, "site-media");
      } else {
        assertObjectKey(key, "product");
      }
      return `${baseUrl.replace(/\/$/, "")}/${key}`;
    },
  };
}
