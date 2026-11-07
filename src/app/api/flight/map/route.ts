import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { worldAirport } from "@/lib/server/flight/world-airports";
import { regionMap } from "@/lib/server/flight/region-map";

/**
 * GET /api/flight/map?codes=DEL,BOM[&live=lat,lon][&theme=dark]
 * Dotted region map for a route (0 aviationstack requests — airport coordinates are local data).
 */
export const GET = route(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const codes = (sp.get("codes") || "").toUpperCase().split(",").filter((c) => /^[A-Z]{3}$/.test(c)).slice(0, 4);
  const pts = codes.map((c) => ({ c, a: worldAirport(c) })).filter((x) => x.a);
  if (pts.length < 2) throw new ApiError(422, "BAD_ROUTE", "Need at least two known airports.");
  const points = pts.map(({ c, a }) => ({ key: c, lat: a!.lat, lon: a!.lon }));
  const live = (sp.get("live") || "").split(",").map(Number);
  if (live.length === 2 && live.every((n) => Number.isFinite(n)) && Math.abs(live[0]) <= 90 && Math.abs(live[1]) <= 180) points.push({ key: "LIVE", lat: live[0], lon: live[1] });
  const map = regionMap(points, sp.get("theme") === "dark" ? "dark" : "light");
  return ok({ map, airports: pts.map(({ c, a }) => ({ iata: c, city: a!.city })) });
});
