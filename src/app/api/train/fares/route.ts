import { trainRoute } from "@/lib/server/train/guard";
import { classCode, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { fareEstimate } from "@/lib/server/train/service";

/** GET /api/train/fares?train=&from=&to=&class=&quota= — fare per class (3 credits). */
export const GET = trainRoute(
  { name: "fares", shape: { train: trainNumber, from: stationCode, to: stationCode, class: classCode.optional(), quota }, limit: 15 },
  (q, c) => fareEstimate({ train: q.train, from: q.from, to: q.to, cls: q.class, quota: q.quota }, { userId: c.userId }),
);
