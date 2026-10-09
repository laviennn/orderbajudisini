import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import {
  createOperator,
  updateOperator,
  resetOperatorPassword,
} from "@/server/services/operators";
export function POST(request: Request) {
  return adminResponse(request, async (input) => {
    const { action, ...data } = z
      .object({ action: z.enum(["create", "update", "reset"]) })
      .catchall(z.unknown())
      .parse(input);
    if (action === "create") return createOperator(data);
    if (action === "reset") return resetOperatorPassword(data);
    return updateOperator(data);
  });
}
