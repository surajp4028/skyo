import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { classCode, journeyDate, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { availabilityCalendar } from "@/lib/server/train/service";

/** GET /api/train/availability/calendar?train=&from=&to=&class=&quota=&date=&days= — multi-day availability (1 request; guests allowed, rate-limited per visitor). */
export const GET = trainRoute(
  {
    name: "calendar",
    shape: { train: trainNumber, from: stationCode, to: stationCode, class: classCode, quota, date: journeyDate({ futureDays: 120 }).optional(), days: z.coerce.number().int().min(1).max(30).default(7) },
    limit: 8,
  },
  (q, c) => availabilityCalendar({ train: q.train, from: q.from, to: q.to, cls: q.class, quota: q.quota, date: q.date, days: q.days }, { userId: c.userId }),
);
