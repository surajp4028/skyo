import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { stationCode } from "@/lib/server/train/validators";
import { stationLiveBoard } from "@/lib/server/train/service";

/** GET /api/train/stations/:code/live?window_hours=4|8 — live arrivals/departures (4 credits, login). */
export const GET = trainRoute(
  { name: "station-live", shape: { code: stationCode, window_hours: z.enum(["4", "8"]).default("4") }, limit: 8, auth: true, live: true },
  (q, c) => stationLiveBoard(q.code, Number(q.window_hours) as 4 | 8, { userId: c.userId }),
);
