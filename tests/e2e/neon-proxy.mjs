// Loaded only by the isolated browser-test server, never by the deployed application.
import { neonConfig as esm } from "@neondatabase/serverless";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { neonConfig: cjs } = require("@neondatabase/serverless");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.TEST_WS_PROXY || ""))
  throw new Error("Test proxy must be loopback");
for (const config of [esm, cjs]) {
  config.wsProxy = () => process.env.TEST_WS_PROXY;
  config.useSecureWebSocket = false;
  config.forceDisablePgSSL = true;
  config.pipelineConnect = false;
}

// Provider-only fixture: the real adapter signs URLs and processes bytes. SDK object I/O
// is redirected to an isolated loopback object store, never to a production R2 bucket.
import { Readable } from "node:stream";
const { S3Client } = require("@aws-sdk/client-s3");
if (process.env.TEST_STORAGE_URL !== "http://127.0.0.1:3101")
  throw new Error("Invalid test object store");
S3Client.prototype.send = async function (command) {
  const { Bucket, Key, Body, ContentType } = command.input;
  const url = `${process.env.TEST_STORAGE_URL}/${encodeURIComponent(`${Bucket}/${Key}`)}`;
  const name = command.constructor.name;
  if (name === "PutObjectCommand") {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": ContentType },
      body: Body,
    });
    if (!response.ok) throw new Error("TEST write failed");
    return {};
  }
  if (name === "DeleteObjectCommand") {
    await fetch(url, { method: "DELETE" });
    return {};
  }
  const response = await fetch(url, {
    method: name === "HeadObjectCommand" ? "HEAD" : "GET",
  });
  if (!response.ok) throw new Error("TEST object absent");
  return {
    ContentLength: Number(response.headers.get("content-length")),
    ContentType: response.headers.get("content-type"),
    ...(name === "GetObjectCommand"
      ? { Body: Readable.from(Buffer.from(await response.arrayBuffer())) }
      : {}),
  };
};
