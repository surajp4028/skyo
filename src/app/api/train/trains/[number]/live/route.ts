import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, stationCode, trainNumber } from "@/lib/server/train/validators";
import { liveTrainStatus } from "@/lib/server/train/service";

/** GET /api/train/trains/:number/live?date=YYYY-MM-DD — live running status (1 request; guests allowed, rate-limited per visitor). */
export const GET = trainRoute(
  {
    name: "live",
    shape: { number: trainNumber, date: journeyDate({ pastDays: 4, futureDays: 1 }), from: stationCode.optional(), to: stationCode.optional() },
    limit: 12,
    live: true,
  },
  (q, c) => liveTrainStatus(q.number, q.date, { from: q.from, to: q.to }, { userId: c.userId }),
);
