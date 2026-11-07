import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { trainNumber } from "@/lib/server/train/validators";
import { trainRoute as fullRoute, trainSchedule, trainStops } from "@/lib/server/train/service";

/** GET /api/train/trains/:number/schedule?view=schedule|stops|route (2 credits). */
export const GET = trainRoute(
  { name: "schedule", shape: { number: trainNumber, view: z.enum(["schedule", "stops", "route"]).default("schedule") }, limit: 15 },
  (q, c) => (q.view === "stops" ? trainStops(q.number, { userId: c.userId }) : q.view === "route" ? fullRoute(q.number, { userId: c.userId }) : trainSchedule(q.number, false, { userId: c.userId })),
);
