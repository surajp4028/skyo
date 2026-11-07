import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, quota, stationCode } from "@/lib/server/train/validators";
import { trainsBetween } from "@/lib/server/train/service";
import { ApiError } from "@/lib/server/http";

/** GET /api/train/between?from=NDLS&to=MMCT&date=YYYY-MM-DD&quota=GN — trains between stations (5 credits). */
export const GET = trainRoute(
  { name: "between", shape: { from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }), quota }, limit: 12 },
  (q, c) => {
    if (q.from === q.to) throw new ApiError(422, "VALIDATION", "From and To stations can't be the same.");
    return trainsBetween(q.from, q.to, q.date, q.quota, { userId: c.userId });
  },
);
