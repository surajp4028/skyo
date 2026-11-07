import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, stationCode, trainNumber } from "@/lib/server/train/validators";
import { availableClasses } from "@/lib/server/train/service";

/** GET /api/train/availability/classes?train=&from=&to=&date= — classes offered (3 credits). */
export const GET = trainRoute(
  { name: "classes", shape: { train: trainNumber, from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }) }, limit: 10 },
  (q, c) => availableClasses(q, { userId: c.userId }),
);
