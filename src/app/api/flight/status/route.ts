import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { liveStatus } from "@/lib/server/flight/status";
import { flightCode } from "@/lib/server/flight/validators";

/** GET /api/flight/status?flight=6E622 — today's live status (logged-in only; cached per flight). */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const p = flightCode.safeParse(req.nextUrl.searchParams.get("flight") || "");
  if (!p.success) throw new ApiError(422, "BAD_FLIGHT", "Enter a flight number like 6E 622.");
  const rl = await rateLimit(`flight:status:${u.id}`, 12, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many live lookups. Please wait a bit.", { retryAfter: rl.retryAfter });
  return ok({ status: await liveStatus(p.data, u.id) });
});
