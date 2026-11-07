import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { exploreConnections } from "@/lib/server/flight/search";
import { monthlyCap, requestsThisMonth } from "@/lib/server/flight/aviationstack";
import { airportCode, cabin, flightDate } from "@/lib/server/flight/validators";

/**
 * POST /api/flight/explore { from, to, date, cabin } — "Find connecting flights" on a route with no direct flight.
 * Spends at most 4 aviationstack requests (fewer when legs are already cached), login only, 3 per user per day,
 * and never eats into the last 10 requests of the month.
 */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const b = await readJson(req, z.object({ from: airportCode, to: airportCode, date: flightDate, cabin }));
  if (b.from === b.to) throw new ApiError(422, "SAME_AIRPORT", "From and To can't be the same.");
  const rl = await rateLimit(`flight:explore:${u.id}`, 3, 86400);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "You've searched connections a few times today. Please try again tomorrow.", { retryAfter: rl.retryAfter });
  const left = (await monthlyCap()) - (await requestsThisMonth());
  const budget = Math.max(0, Math.min(4, left - 10));
  return ok(await exploreConnections({ ...b, userId: u.id, budget }));
});
