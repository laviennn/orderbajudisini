import "server-only";
import { parseEnvironment } from "@/lib/env-schema";

export function getEnvironment() {
  return parseEnvironment(process.env);
}
