import { trainRoute } from "@/lib/server/train/guard";
import { classCode, journeyDate, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { seatAvailability } from "@/lib/server/train/service";

/** GET /api/train/availability?train=&from=&to=&date=&class=&quota= — live seat availability (5 credits, login). */
export const GET = trainRoute(
  { name: "availability", shape: { train: trainNumber, from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }), class: classCode, quota }, limit: 20, auth: true },
  (q, c) => seatAvailability({ train: q.train, from: q.from, to: q.to, date: q.date, cls: q.class, quota: q.quota }, { userId: c.userId }),
);
