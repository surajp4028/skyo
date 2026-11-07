import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, quota, stationCode } from "@/lib/server/train/validators";
import { trainsBetween } from "@/lib/server/train/service";
import { ApiError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";

/**
 * GET /api/train/between?from=NDLS&to=MMCT&date=YYYY-MM-DD&quota=GN — trains between stations (5 credits).
 * Admin → Settings → Trains → "Dev: show only 1 train" trims the list so testing doesn't burn credits
 * on availability / schedule look-ups for every result.
 */
export const GET = trainRoute(
  { name: "between", shape: { from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }), quota }, limit: 12 },
  async (q, c) => {
    if (q.from === q.to) throw new ApiError(422, "VALIDATION", "From and To stations can't be the same.");
    const r = await trainsBetween(q.from, q.to, q.date, q.quota, { userId: c.userId });
    if ((await getSetting("train_dev_single_result")) === "on" && r.data.trains.length > 1) {
      return { ...r, data: { ...r.data, trains: r.data.trains.slice(0, 1), dev_limited: { shown: 1, total: r.data.trains.length } } };
    }
    return r;
  },
);
