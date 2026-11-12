import { z } from "zod";
import { ApiError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";
import { trainRoute } from "@/lib/server/train/guard";
import { classCode, journeyDate, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { trainChances } from "@/lib/server/train/chances";

// one entry per train: "12309:NDLS:RJPB:3A.2A"
const entry = z.string().transform((v, ctx) => {
  const [train, from, to, cls] = v.split(":");
  const t = trainNumber.safeParse(train), f = stationCode.safeParse(from), d = stationCode.safeParse(to);
  const c = z.array(classCode).min(1).max(8).safeParse((cls || "").split(".").filter(Boolean));
  if (!t.success || !f.success || !d.success || !c.success) {
    ctx.addIssue({ code: "custom", message: "Invalid train entry" });
    return z.NEVER;
  }
  return { train: t.data, from: f.data, to: d.data, classes: c.data };
});

/**
 * GET /api/train/chances?date=&quota=&t=12309:NDLS:RJPB:3A.2A,20802:NDLS:RJPB:SL — real % chance for the waitlisted
 * classes of every train in a search, in one or two batch calls. Same guest rule as alternate seats.
 */
export const GET = trainRoute(
  { name: "chances", shape: { date: journeyDate({ futureDays: 120 }), quota, t: z.string().trim().max(2000).transform((v) => v.split(",").filter(Boolean)).pipe(z.array(entry).min(1).max(40)) }, limit: 120 },
  async (q, c) => {
    if ((await getSetting("train_alt_seats")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Chances aren't available right now.");
    if (!c.userId && (await getSetting("train_alt_guests")) !== "on") throw new ApiError(401, "LOGIN_REQUIRED", "Log in to see confirmation chances.");
    return trainChances({ items: q.t, date: q.date, quota: q.quota, userId: c.userId });
  },
);
