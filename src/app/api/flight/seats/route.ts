import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { optionById } from "@/lib/server/flight/search";
import { seatMapFor } from "@/lib/server/flight/seats";
import { airportCode, cabin, flightDate, optionId } from "@/lib/server/flight/validators";
import { parseQuery } from "@/lib/server/train/validators";
import type { CabinKey } from "@/lib/flight/airlines";

/** GET /api/flight/seats?from=DEL&to=BOM&date=…&option=6E622&cabin=economy — seat map per segment (0 aviationstack requests). */
export const GET = route(async (req: NextRequest) => {
  const parsed = parseQuery(req.nextUrl.searchParams, { from: airportCode, to: airportCode, date: flightDate, option: optionId, cabin });
  if (!parsed.success) throw new ApiError(422, "VALIDATION", parsed.error.issues[0]?.message || "Invalid input");
  const q = parsed.data as { from: string; to: string; date: string; option: string; cabin: CabinKey };
  const o = await optionById(q.from, q.to, q.date, q.option);
  if (!o) throw new ApiError(404, "FLIGHT_GONE", "This flight is no longer in the schedule. Please search again.");
  const legs = await Promise.all(
    o.legs.map(async (l) => {
      const m = await seatMapFor(l.key, q.date, l.aircraft.code, q.cabin);
      return { key: l.key, flight: `${l.airline.iata} ${l.number}`, from: l.from.iata, to: l.to.iata, aircraft: l.aircraft, layout: m?.layout ?? null, seats: m?.seats ?? [] };
    }),
  );
  return ok({ legs });
});
