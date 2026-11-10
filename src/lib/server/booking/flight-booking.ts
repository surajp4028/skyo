import "server-only";
import crypto from "node:crypto";
import { exec, transaction } from "../db";
import { encrypt } from "../crypto";
import { ApiError } from "../http";
import { getAllSettings, getSetting } from "../settings";
import { getPassengersByIds, updatePassenger } from "./passengers";
import { createOrder } from "../payments/razorpay";
import { loadMe } from "../me";
import { reserveCoupon, validateCoupon } from "../coupons";
import { getUserGst, saveBilling, type Billing } from "../gst";
import { optionById } from "../flight/search";
import { holdSeats, seatMapFor } from "../flight/seats";
import { logProvider } from "../payments/log";
import { airlineInfo, CABIN_LABEL, type CabinKey } from "@/lib/flight/airlines";
import { flightCharges, needsPassport, optionFare, paxType, todayIST, type FlightChargeBreakdown, type FlightChargeSettings, type FlightLeg, type FlightOption } from "@/lib/flight/model";
import type { PayMode } from "@/lib/charges-core";

const HOLD_MINUTES = 15;

export type Passport = { number: string; expiry: string; nationality: string };
export type FlightPassenger = { name: string; age: number; gender: "M" | "F" | "T"; nationality: string; type: "adult" | "child" | "infant"; seats: Record<string, string | null>; passport?: Passport | null; profileId?: number };

export type FlightBookingDetails = {
  kind: "flight";
  /** Display label shared with the train screens (title / number column). */
  train: { number: string; name: string };
  flight: Pick<FlightOption, "id" | "legs" | "layovers" | "stops" | "durationMin" | "dep" | "arr" | "dayOffset" | "baggage" | "refundable"> & { cabin: CabinKey };
  from: string; to: string; date: string; cls: string; quota: string;
  food: false;
  passengers: FlightPassenger[];
  pricing: { baseFare: number; catering: 0; perPassenger: number; count: number; total: number; currency: "INR" };
  charges?: FlightChargeBreakdown;
  payMode?: PayMode;
  insurance?: { opted: boolean; perPassenger: number; total: number; status: "pending_policy" | "not_opted" };
  billing?: Billing | null;
  gst?: { gstin: string; company: string; address: string | null; pincode: string | null; state: string | null } | null;
  notifyEmail?: string | null;
  methodMismatch?: { priced: PayMode; paidWith: string };
  availability: { status: string; text: string; checkedAt: string | null };
  contact: { name: string | null; email: string | null; phone: string | null };
  schedule: { source: "aviationstack"; fetchedAt: string | null };
  ticket?: {
    pnr: string; ticketNo: string; chartStatus: string; issuedAt: string; provider: string; providerPdfKey?: string | null;
    airlinePnrs: Record<string, string>;
    allocations: { name: string; age: number; gender: string; status: string; type: string; eticket: string; seats: Record<string, string>; coach?: string; berth?: number; berthType?: string }[];
  };
  failure?: string;
};

const newRef = () => "SKT" + crypto.randomInt(10_000_000, 100_000_000);
export const flightLabel = (legs: FlightLeg[]) => legs.map((l) => `${l.airline.iata} ${l.number}`).join(" + ");

/**
 * Start a flight booking. The browser sends WHAT to book (flight, cabin, travellers, seats) — never the amount.
 * The option is rebuilt from the cached schedule (0 aviationstack requests), priced here, seats are held
 * in the same transaction as the booking row, then the Razorpay order is created for exactly that total.
 */
export async function initiateFlightBooking(
  user: { id: number; uid: string },
  p: { optionId: string; from: string; to: string; date: string; cabin: CabinKey; passengerIds: number[]; seats: Record<string, string[]>; payMode: PayMode; insurance: boolean; couponCode?: string | null; billing?: Billing | null; useGst?: boolean; notifyEmail?: string | null; passports?: Record<string, Passport>; savePassports?: boolean },
) {
  const maxPax = Math.min(9, Math.max(1, parseInt(await getSetting("max_passengers_per_flight"), 10) || 9));
  const ids = [...new Set(p.passengerIds)];
  if (ids.length < 1) throw new ApiError(422, "NO_PASSENGERS", "Select at least one traveller.");
  if (ids.length > maxPax) throw new ApiError(422, "TOO_MANY_PASSENGERS", `You can book up to ${maxPax} travellers in one booking.`);
  if (p.date < todayIST()) throw new ApiError(422, "PAST_DATE", "Pick today or a later date.");
  const pax = await getPassengersByIds(user.id, ids);
  const mix = { adults: pax.filter((x) => paxType(x.age) === "adult").length, children: pax.filter((x) => paxType(x.age) === "child").length, infants: pax.filter((x) => paxType(x.age) === "infant").length };
  if (mix.adults < 1) throw new ApiError(422, "NO_ADULT", "Add at least one adult (12+) — children and infants can't fly alone on this booking.");
  if (mix.infants > mix.adults) throw new ApiError(422, "TOO_MANY_INFANTS", "Each infant travels on an adult's lap — one infant per adult.");
  // infants sit on a lap: only adults and children get seats, in the order they were selected
  const seatPax = pax.filter((x) => paxType(x.age) !== "infant");

  const coupon = p.couponCode ? await validateCoupon(p.couponCode, user.uid, "flight") : null;
  const option = await optionById(p.from, p.to, p.date, p.optionId);
  if (!option) throw new ApiError(409, "FLIGHT_GONE", "This flight is no longer in the schedule. Please search again.");
  const quote = option.fares[p.cabin];
  if (!quote) throw new ApiError(409, "CABIN_NA", `${CABIN_LABEL[p.cabin]} isn't available on this flight.`);
  // international: every traveller needs a passport valid beyond the travel date
  // international: passports now (mode "booking") or later from My trips (mode "later");
  // anything provided must be valid beyond the travel date. Saved-traveller passports are used when none is sent.
  const intl = needsPassport(option.legs);
  const ppMode = await getSetting("flight_passport_mode");
  const ppOf = (x: (typeof pax)[number]): Passport | null => p.passports?.[String(x.id)] ?? (x.passport ? { ...x.passport, nationality: x.nationality } : null);
  if (intl) {
    for (const x of pax) {
      const pp = ppOf(x);
      if (!pp && ppMode === "booking") throw new ApiError(422, "PASSPORT_REQUIRED", `Add passport details for ${x.name} — this trip leaves India.`);
      if (pp && pp.expiry <= p.date) throw new ApiError(422, "PASSPORT_EXPIRED", `${x.name}'s passport expires before the journey.`);
    }
  }
  if (quote.seatsLeft < seatPax.length) throw new ApiError(409, "SOLD_OUT", `Only ${quote.seatsLeft} seat${quote.seatsLeft === 1 ? "" : "s"} left in ${CABIN_LABEL[p.cabin]}.`);

  // ---- seats: validated against the live seat map, fees from the server's settings
  const picks: { key: string; seat: string; feePaise: number; pax: number }[] = [];
  for (const leg of option.legs) {
    const wanted = (p.seats[leg.key] || []).slice(0, seatPax.length);
    if (!wanted.length) continue;
    if (new Set(wanted).size !== wanted.length) throw new ApiError(422, "SEAT_DUP", "Each traveller needs a different seat.");
    const map = await seatMapFor(leg.key, p.date, leg.aircraft.code, p.cabin);
    if (!map) throw new ApiError(409, "CABIN_NA", "Seat map not available.");
    wanted.forEach((id, i) => {
      const s = map.seats.find((x) => x.id === id);
      if (!s) throw new ApiError(422, "SEAT_INVALID", `Seat ${id} doesn't exist on ${leg.airline.iata} ${leg.number}.`);
      if (s.taken) throw new ApiError(409, "SEAT_TAKEN", `Seat ${id} on ${leg.airline.iata} ${leg.number} was just taken. Please pick another.`);
      picks.push({ key: leg.key, seat: id, feePaise: s.feePaise, pax: i });
    });
  }
  const seatFees = picks.reduce((a, x) => a + x.feePaise, 0);

  const s = (await getAllSettings()) as unknown as FlightChargeSettings;
  const fare = optionFare(s, option.legs, p.date, p.cabin);
  const charges = flightCharges(s, {
    fare, pax: mix, cabin: p.cabin, seatFeesPaise: seatFees, seatNote: picks.length ? picks.map((x) => x.seat).join(", ") : undefined,
    payMode: p.payMode, insurance: p.insurance, coupon: coupon?.rule ?? null,
  });
  if (coupon && !charges.coupon) throw new ApiError(409, "COUPON_NOT_APPLICABLE", charges.couponError || "This coupon can't be applied to this booking.");
  const total = charges.totalPaise;
  const ins = charges.lines.find((l) => l.key === "insurance");
  const me = await loadMe(user.id);
  if (p.billing) await saveBilling(user.id, p.billing);
  const gst = p.useGst ? await getUserGst(user.id) : null;
  const first = option.legs[0];
  const label = flightLabel(option.legs);

  const details: FlightBookingDetails = {
    kind: "flight",
    train: { number: label, name: option.legs.length > 1 ? `${airlineInfo(first.airline.iata).name} · 1 stop` : airlineInfo(first.airline.iata).name },
    flight: { id: option.id, legs: option.legs, layovers: option.layovers, stops: option.stops, durationMin: option.durationMin, dep: option.dep, arr: option.arr, dayOffset: option.dayOffset, baggage: option.baggage, refundable: option.refundable, cabin: p.cabin },
    from: p.from, to: p.to, date: p.date, cls: CABIN_LABEL[p.cabin], quota: "GN", food: false,
    passengers: pax.map((x) => {
      const si = seatPax.indexOf(x);
      return {
        name: x.name, age: x.age, gender: x.gender, nationality: (intl && ppOf(x)?.nationality) || x.nationality, type: paxType(x.age),
        passport: intl ? ppOf(x) : null, profileId: x.id,
        seats: Object.fromEntries(option.legs.map((l) => [l.key, si < 0 ? null : picks.find((k) => k.key === l.key && k.pax === si)?.seat ?? null])),
      };
    }),
    pricing: { baseFare: fare.basePaise / 100, catering: 0, perPassenger: fare.perAdultPaise / 100, count: pax.length, total: total / 100, currency: "INR" },
    charges,
    // no payMode: flight charges don't differ by method, so Checkout offers every method
    insurance: ins ? { opted: true, perPassenger: ins.paise / 100 / pax.length, total: ins.paise / 100, status: "pending_policy" } : { opted: false, perPassenger: 0, total: 0, status: "not_opted" },
    availability: { status: "AVAILABLE", text: `${quote.seatsLeft} seats left`, checkedAt: new Date().toISOString() },
    contact: { name: me?.name ?? null, email: me?.email ?? null, phone: me?.phone ?? null },
    billing: p.billing ?? null,
    gst: gst ? { gstin: gst.gstin, company: gst.company, address: gst.address, pincode: gst.pincode, state: gst.state } : null,
    notifyEmail: me?.email ? null : p.notifyEmail || null,
    schedule: { source: "aviationstack", fetchedAt: null },
  };

  let ref = newRef();
  for (let i = 0; i < 4; i++) {
    try {
      await transaction(async (conn) => {
        await conn.query(
          `INSERT INTO bookings (booking_ref, user_uid, service, status, payment_status, title_enc, origin_enc, destination_enc, details_enc, provider,
                                 travel_date, travellers, amount_paise, currency, pay_provider, charges_enc, hold_expires_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
          [ref, user.uid, "flight", "pending", "unpaid", await encrypt(`${details.train.name} · ${label}`), await encrypt(p.from), await encrypt(p.to),
           await encrypt(JSON.stringify(details)), "aviationstack", p.date, pax.length, total, "INR", "razorpay", await encrypt(JSON.stringify(charges)), HOLD_MINUTES],
        );
        if (picks.length) await holdSeats(conn, ref, p.date, p.cabin, picks);
      });
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY" && !(e instanceof ApiError) && i < 3) {
        ref = newRef();
        continue;
      }
      throw e;
    }
  }
  // remember newly typed passports on the traveller's profile (asked in the booking sheet)
  if (intl && p.savePassports) {
    for (const x of pax) {
      const pp = p.passports?.[String(x.id)];
      if (pp && (pp.number !== x.passport?.number || pp.expiry !== x.passport?.expiry)) {
        const { id, ...rest } = x;
        await updatePassenger(user.id, id, { ...rest, nationality: pp.nationality || rest.nationality, passport: { number: pp.number, expiry: pp.expiry } }).catch(() => {});
      }
    }
  }
  await logProvider({ bookingRef: ref, provider: "aviationstack", direction: "outbound", action: "schedule.snapshot", outcome: "ok", request: { from: p.from, to: p.to, date: p.date, option: option.id, cabin: p.cabin }, response: { legs: option.legs.map((l) => ({ key: l.key, dep: l.from.time, arr: l.to.time, aircraft: l.aircraft.code, terminal: l.from.terminal })), seatsLeft: quote.seatsLeft, seats: picks } });

  if (charges.coupon) {
    try {
      await reserveCoupon(charges.coupon.code, user.uid, "flight", ref, charges.coupon.discountPaise);
    } catch (e) {
      await exec("UPDATE bookings SET status = 'failed' WHERE booking_ref = ?", [ref]);
      throw e;
    }
  }

  const order = await createOrder({
    amountPaise: total,
    receipt: `SKYO_${ref}`,
    bookingRef: ref,
    notes: { booking_ref: ref, user: user.uid, service: "flight", flight: label, cabin: p.cabin, date: p.date, route: `${p.from}-${p.to}`, passengers: String(pax.length), pay_mode: p.payMode, insurance: ins ? "yes" : "no", coupon: charges.coupon?.code ?? "", seats: picks.map((x) => `${x.key}:${x.seat}`).join(" ").slice(0, 200) },
  });
  await exec("UPDATE bookings SET pay_order_id = ? WHERE booking_ref = ?", [order.id, ref]);
  return { bookingRef: ref, order, details };
}
