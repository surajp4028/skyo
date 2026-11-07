import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { searchAirports } from "@/lib/flight/airports";

/** GET /api/flight/airports?q=del — airport suggestions from SKYO's own directory (0 aviationstack requests). */
export const GET = route(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 40);
  return ok({ airports: searchAirports(q, 10).map(({ iata, city, name, state, country }) => ({ iata, city, name, state, country })) });
});
