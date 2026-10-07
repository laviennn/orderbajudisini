import { z } from "zod";

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
function protocolIs(value: string, protocols: string[]) {
  const url = URL.parse(value);
  return url !== null && protocols.includes(url.protocol);
}
const secureUrl = z.url().refine((value) => protocolIs(value, ["https:"]));

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: optional(
      z.url().refine((value) => protocolIs(value, ["http:", "https:"])),
    ),
    DATABASE_URL: optional(
      z
        .string()
        .url()
        .refine((value) => protocolIs(value, ["postgres:", "postgresql:"])),
    ),
    AUTH_SECRET: optional(z.string().min(32)),
    AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
    R2_ACCOUNT_ID: optional(z.string().regex(/^[a-f0-9]{32}$/)),
    R2_ACCESS_KEY_ID: optional(z.string().min(1)),
    R2_SECRET_ACCESS_KEY: optional(z.string().min(1)),
    R2_PUBLIC_BUCKET: optional(
      z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
    ),
    R2_PRIVATE_BUCKET: optional(
      z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
    ),
    R2_PUBLIC_BASE_URL: optional(
      secureUrl.refine((value) => {
        const url = URL.parse(value);
        return (
          url !== null &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (
      value.R2_PUBLIC_BUCKET &&
      value.R2_PUBLIC_BUCKET === value.R2_PRIVATE_BUCKET
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["R2_PRIVATE_BUCKET"],
        message: "Buckets must be separate",
      });
    }
  });

export type Environment = z.infer<typeof schema>;

export function parseEnvironment(input: Record<string, unknown>): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Zod details can contain supplied values; report only variable names.
    const names = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
  return result.data;
}

export type ConfigurationState =
  { status: "configured" } | { status: "unavailable"; missing: string[] };

export function configurationState(
  env: Environment,
  keys: (keyof Environment)[],
): ConfigurationState {
  const missing = keys.filter((key) => !env[key]);
  return missing.length
    ? { status: "unavailable", missing }
    : { status: "configured" };
}
