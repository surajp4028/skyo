import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { getSetting, getPublicSettings } from "@/lib/server/settings";
import { classCode, journeyDate, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { checkoutOptions, initiateTrainBooking } from "@/lib/server/booking/train-booking";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/**
 * Start a train booking. The browser sends WHAT to book — never the amount.
 * The server re-prices from live availability and creates the Razorpay order.
 */
export const POST = route(async (req: NextRequest) => {
  if ((await getSetting("service_train")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Train booking is not available.");
  const u = await requireUser();
  const rl = await rateLimit(`booking:init:${u.id}`, 6, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many booking attempts. Please wait a few minutes.", { retryAfter: rl.retryAfter });
  const body = await readJson(
    req,
    z.object({
      train: trainNumber,
      trainName: z.string().trim().min(1).max(80),
      from: stationCode,
      to: stationCode,
      date: journeyDate({ futureDays: 120 }),
      cls: classCode,
      quota,
      passengerIds: z.array(z.number().int().positive()).min(1).max(6),
      food: z.boolean().default(true),
      payMode: z.enum(["upi", "card"]).default("upi"),
      insurance: z.boolean().default(true),
    }),
  );
  const r = await initiateTrainBooking({ id: u.id, uid: u.uid }, body);
  await audit({ actorType: "user", actorId: u.id, action: "booking.initiated", targetType: "booking", targetId: r.bookingRef, ip: getClientIp(req.headers), meta: { amount: r.order.amount, pax: r.details.pricing.count } });
  const site = await getPublicSettings();
  return ok({ bookingRef: r.bookingRef, pricing: r.details.pricing, charges: r.details.charges, checkout: checkoutOptions(r.bookingRef, r.order.id, r.order.amount, r.details, site.site_name) });
});
