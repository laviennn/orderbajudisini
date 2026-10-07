import { authenticationEnabled, handlers } from "@/server/auth";
import { AppError, toApiError } from "@/lib/errors";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function unavailable() {
  return Response.json(
    { error: toApiError(new AppError("NOT_CONFIGURED")) },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const GET = (request: NextRequest) =>
  authenticationEnabled() ? handlers.GET(request) : unavailable();
export const POST = (request: NextRequest) =>
  authenticationEnabled() ? handlers.POST(request) : unavailable();
