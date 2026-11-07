import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, stationCode, trainNumber } from "@/lib/server/train/validators";
import { chartStatus, vacantBerths, vacantBerthsHopping } from "@/lib/server/train/service";

/**
 * GET /api/train/charts/status | vacant-berths | hopping
 * RailCore Scale/Enterprise only — on the Free plan this answers 403 PLAN_REQUIRED without calling RailCore.
 */
export const GET = trainRoute(
  {
    name: "charts",
    shape: {
      kind: z.enum(["status", "vacant-berths", "hopping"]),
      train: trainNumber,
      date: journeyDate({ pastDays: 1, futureDays: 2 }),
      from: stationCode.optional(),
      to: stationCode.optional(),
      station: stationCode.optional(),
    },
    limit: 6,
    auth: true,
  },
  (q, c) => {
    const o = { userId: c.userId };
    if (q.kind === "status") return chartStatus({ train: q.train, date: q.date, station: q.station || q.from || "" }, o);
    if (q.kind === "vacant-berths") return vacantBerths({ train: q.train, from: q.from || "", to: q.to || "", date: q.date }, o);
    return vacantBerthsHopping({ train: q.train, from: q.from || "", to: q.to || "", date: q.date }, o);
  },
);
