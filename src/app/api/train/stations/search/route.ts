import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { searchAllStations } from "@/lib/server/train/stations-index";
import { searchStations } from "@/lib/server/train/service";
import { getSetting } from "@/lib/server/settings";

/**
 * Station autocomplete over ~9,000 Indian stations (0 credits).
 * RailCore is asked only when nothing matches locally and the query has ≥ 3 chars (1 credit).
 */
export const GET = route(async (req: NextRequest) => {
  if ((await getSetting("service_train")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Train service is not available.");
  const ip = getClientIp(req.headers);
  const local = await rateLimit(`train:stations-local:${ip}`, 300, 600);
  if (!local.ok) throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please slow down.");
  const q = z.string().trim().min(1).max(60).safeParse(req.nextUrl.searchParams.get("q") || "");
  if (!q.success) return ok({ stations: [] });
  const hits = searchAllStations(q.data, 10);
  if (hits.length > 0 || q.data.length < 3) return ok({ stations: hits });

  const rl = await rateLimit(`train:stations:${ip}`, 30, 600);
  if (!rl.ok) return ok({ stations: [] });
  try {
    const r = await searchStations(q.data, 8);
    const list = r.data.results || [];
    return ok({ stations: list.map((s) => ({ code: s.station_code, name: s.display_name || s.station_name, city: s.city || s.state || "", source: "railcore" as const })) });
  } catch (e) {
    if (e instanceof ApiError) return ok({ stations: [] });
    throw e;
  }
});
