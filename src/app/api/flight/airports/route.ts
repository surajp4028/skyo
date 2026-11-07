import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { searchWorldAirports } from "@/lib/server/flight/world-airports";

/** GET /api/flight/airports?q=del — suggestions from ~7,900 airports worldwide (0 aviationstack requests). */
export const GET = route(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 40);
  return ok({ airports: searchWorldAirports(q, 12).map(({ iata, city, name, state, country, countryName }) => ({ iata, city, name, state, country, countryName })) });
});
