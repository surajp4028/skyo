import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, quota, stationCode } from "@/lib/server/train/validators";
import { faresOnRoute } from "@/lib/server/train/service";

/** GET /api/train/fares/search?from=&to=&date=&quota= — fares across trains on a route (3 credits). */
export const GET = trainRoute(
  { name: "fares-route", shape: { from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }), quota }, limit: 10 },
  (q, c) => faresOnRoute(q, { userId: c.userId }),
);
