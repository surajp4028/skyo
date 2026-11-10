import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { exec, queryOne } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { getPassengersByIds, updatePassenger } from "@/lib/server/booking/passengers";
import { logProvider } from "@/lib/server/payments/log";
import { needsPassport, todayIST } from "@/lib/flight/model";
import type { FlightBookingDetails } from "@/lib/server/booking/flight-booking";

type Ctx = { params: Promise<{ ref: string }> };

/**
 * POST /api/bookings/{ref}/passports — add / update passports on an international flight booking after
 * booking ("add later" mode). Owner only, until the travel date. Optionally saves them to the traveller profiles.
 * Passport numbers are never written to logs.
 */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const u = await requireUser();
  const ref = (await params).ref;
  if (!/^SKT\d{8}$/.test(ref)) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  const rl = await rateLimit(`booking:passports:${u.id}`, 20, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many updates. Please wait a bit.", { retryAfter: rl.retryAfter });
  const body = await readJson(
    req,
    z.object({
      passports: z.record(
        z.string().regex(/^\d{1,2}$/),
        z.object({
          number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,9}$/, "Passport number: 6–9 letters / digits"),
          expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Passport expiry: pick a date"),
          nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Nationality: 2-letter code"),
        }),
      ),
      save: z.boolean().default(true),
    }),
  );
  const b = await queryOne<{ id: number; user_uid: string; service: string; status: string; details_enc: string }>(
    "SELECT id, user_uid, service, status, details_enc FROM bookings WHERE booking_ref = ?",
    [ref],
  );
  if (!b || b.user_uid !== u.uid || b.service !== "flight") throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (!["confirmed", "pending"].includes(b.status)) throw new ApiError(409, "CLOSED", "This booking can't be changed any more.");
  const d = JSON.parse(await decrypt(b.details_enc)) as FlightBookingDetails;
  if (!needsPassport(d.flight.legs)) throw new ApiError(409, "NOT_INTERNATIONAL", "Passports aren't needed for this trip.");
  if (d.date < todayIST()) throw new ApiError(409, "DEPARTED", "This trip has already started.");

  let changed = 0;
  for (const [k, pp] of Object.entries(body.passports)) {
    const i = Number(k);
    const pax = d.passengers[i];
    if (!pax) throw new ApiError(422, "BAD_TRAVELLER", "Unknown traveller.");
    if (pp.expiry <= d.date) throw new ApiError(422, "PASSPORT_EXPIRED", `${pax.name}'s passport expires before the journey.`);
    pax.passport = pp;
    pax.nationality = pp.nationality;
    changed++;
    if (body.save && pax.profileId) {
      const [saved] = await getPassengersByIds(u.id, [pax.profileId]).catch(() => []);
      if (saved) {
        const { id, ...rest } = saved;
        await updatePassenger(u.id, id, { ...rest, nationality: pp.nationality, passport: { number: pp.number, expiry: pp.expiry } }).catch(() => {});
      }
    }
  }
  await exec("UPDATE bookings SET details_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(d)), b.id]);
  const missing = d.passengers.filter((p) => !p.passport).length;
  await audit({ actorType: "user", actorId: u.id, action: "booking.passports_updated", targetType: "booking", targetId: ref, ip: getClientIp(req.headers), meta: { travellers: changed, missing } });
  // the ticketing partner gets the passports (APIS) once Tripgic is live — logged without the numbers
  await logProvider({ bookingRef: ref, provider: "skyo", direction: "inbound", action: "flight.passports", outcome: "ok", request: { travellers: changed }, response: { missing, note: "Passport data stored encrypted; numbers not logged" } });
  return ok({ missing });
});
