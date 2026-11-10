import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { airportBoard } from "@/lib/server/flight/board";
import { airportCode } from "@/lib/server/flight/validators";

/**
 * GET /api/flight/board?code=DEL&type=departure|arrival — today's live board for one airport.
 * Anyone sees a cached board; loading a fresh one (1 aviationstack request) needs login, 6 per user per day.
 */
export const GET = route(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const code = airportCode.safeParse(sp.get("code") || "");
  if (!code.success) throw new ApiError(422, "VALIDATION", code.error.issues[0]?.message || "Pick an airport");
  const type = sp.get("type") === "arrival" ? "arrival" : "departure";
  const user = await getSessionUser();
  const who = user ? `u:${user.id}` : `ip:${getClientIp(req.headers)}`;
  const rl = await rateLimit(`flight:board:view:${who}`, 60, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please wait a bit.", { retryAfter: rl.retryAfter });
  // a refresh (1 aviationstack request) needs login and counts against 6 per user per day
  const allowFetch = user ? async () => (await rateLimit(`flight:board:fetch:${user.id}`, 6, 86400)).ok : false;
  return ok({ board: await airportBoard(code.data, type, { allowFetch, userId: user?.id ?? null }) });
});
