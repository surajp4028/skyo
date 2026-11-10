import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { getSetting, getPublicSettings } from "@/lib/server/settings";
import { checkoutOptions, type TrainBookingDetails } from "@/lib/server/booking/train-booking";
import { initiateFlightBooking } from "@/lib/server/booking/flight-booking";
import { airportCode, cabin, flightDate, optionId } from "@/lib/server/flight/validators";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { billingSchema } from "@/lib/server/gst";

/**
 * POST /api/bookings/flight/initiate — start a flight booking. The browser sends WHAT to book, never the amount.
 * The server rebuilds the flight from its cached schedule, prices it, holds the seats and creates the Razorpay order.
 */
export const POST = route(async (req: NextRequest) => {
  if ((await getSetting("service_flight")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Flight booking is not available.");
  const u = await requireUser();
  const rl = await rateLimit(`booking:init:${u.id}`, 6, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many booking attempts. Please wait a few minutes.", { retryAfter: rl.retryAfter });
  const seat = z.string().regex(/^\d{1,2}[A-K]$/);
  const body = await readJson(
    req,
    z.object({
      optionId,
      from: airportCode,
      to: airportCode,
      date: flightDate,
      cabin,
      passengerIds: z.array(z.number().int().positive()).min(1).max(9),
      seats: z.record(z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/), z.array(seat).max(9)).default({}),
      payMode: z.enum(["upi", "card"]).default("upi"),
      insurance: z.boolean().default(true),
      billing: billingSchema.nullable().optional(),
      useGst: z.boolean().default(false),
      notifyEmail: z.union([z.literal(""), z.null(), z.string().trim().toLowerCase().email().max(120)]).optional(),
      couponCode: z.string().trim().max(32).regex(/^[A-Za-z0-9_-]*$/).optional().nullable(),
      passports: z
        .record(
          z.string().regex(/^\d{1,10}$/),
          z.object({
            number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,9}$/, "Passport number: 6–9 letters / digits"),
            expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Passport expiry: YYYY-MM-DD"),
            nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Nationality: 2-letter code"),
          }),
        )
        .optional(),
      savePassports: z.boolean().default(true),
    }),
  );
  const billing = body.billing ? { state: body.billing.state, pincode: body.billing.pincode || null, address: body.billing.address || null } : null;
  const r = await initiateFlightBooking({ id: u.id, uid: u.uid }, { ...body, billing });
  await audit({ actorType: "user", actorId: u.id, action: "booking.initiated", targetType: "booking", targetId: r.bookingRef, ip: getClientIp(req.headers), meta: { service: "flight", amount: r.order.amount, pax: r.details.pricing.count } });
  const site = await getPublicSettings();
  return ok({ bookingRef: r.bookingRef, pricing: r.details.pricing, charges: r.details.charges, checkout: checkoutOptions(r.bookingRef, r.order.id, r.order.amount, r.details as unknown as TrainBookingDetails, site.site_name) });
});
