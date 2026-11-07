import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { getRoute, searchFlights } from "@/lib/server/flight/search";
import { airportCode, cabin, flightDate } from "@/lib/server/flight/validators";
import { parseQuery } from "@/lib/server/train/validators";

/**
 * GET /api/flight/search?from=DEL&to=BOM&date=2026-11-20&cabin=economy
 * A cached route costs nothing. A route nobody searched yet costs ONE aviationstack request,
 * and each visitor may open only a few new routes per day so the 100 / month budget can't be drained.
 */
export const GET = route(async (req: NextRequest) => {
  const parsed = parseQuery(req.nextUrl.searchParams, { from: airportCode, to: airportCode, date: flightDate, cabin });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new ApiError(422, "VALIDATION", i?.message || "Invalid input", { field: i?.path.join(".") });
  }
  const q = parsed.data as { from: string; to: string; date: string; cabin: z.infer<typeof cabin> };
  if (q.from === q.to) throw new ApiError(422, "SAME_AIRPORT", "From and To can't be the same.");
  const user = await getSessionUser();
  const who = user ? `u:${user.id}` : `ip:${getClientIp(req.headers)}`;
  const rl = await rateLimit(`flight:search:${who}`, 40, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many searches. Please wait a few minutes.", { retryAfter: rl.retryAfter });

  const cached = await getRoute(q.from, q.to, { allowFetch: false, reason: "probe" });
  let allowFetch = true;
  if (!cached || cached.stale) {
    const budget = await rateLimit(`flight:newroute:${who}`, user ? 6 : 2, 86400);
    allowFetch = budget.ok;
    if (!allowFetch && !cached) throw new ApiError(429, "NEW_ROUTE_LIMIT", user ? "You've opened many new routes today. Try a popular route or come back tomorrow." : "Log in to search this route.");
  }
  const r = await searchFlights({ ...q, userId: user?.id ?? null, allowFetch });
  return ok({ ...r, query: q });
});
