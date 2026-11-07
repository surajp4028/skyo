/**
 * Flight model shared by server and browser: itinerary types, the SKYO fare model, the charge
 * breakdown and the seat-occupancy model.
 *
 * aviationstack gives schedules / status only — no prices or seat inventory. Until the ticketing
 * partner (Tripgic) returns live fares, SKYO prices a flight with the admin-set fare model below
 * (distance, cabin, days to departure, time of day, airline type) and the server is always the
 * one that computes the payable amount.
 */
import { airportByCode, distanceKm } from "./airports";
import { airlineInfo, AIRCRAFT, type AircraftCode, type CabinKey, type CabinLayout, seatKind, seatsOf, parseSeat } from "./airlines";
import { finishCharges, numSetting, pctOf, rupeesToPaise, type ChargeLine, type CouponApplied, type CouponRule, type PayMode } from "@/lib/charges-core";

/* --------------------------------- types --------------------------------- */

export type FlightPoint = { iata: string; airport: string; city: string; terminal: string | null; gate: string | null; time: string /* HH:MM local */; tz: string; country?: string; lat?: number; lon?: number };

/** Any leg leaving / entering India → passports needed. */
export const needsPassport = (legs: Pick<FlightLeg, "from" | "to">[]) => legs.some((l) => !isDomesticPair(l.from, l.to));

/** Domestic (both ends in India) — uses the country stored on the leg, else SKYO's airport list. */
export function isDomesticPair(a: Pick<FlightPoint, "iata" | "country">, b: Pick<FlightPoint, "iata" | "country">) {
  const ca = a.country ?? airportByCode(a.iata)?.country;
  const cb = b.country ?? airportByCode(b.iata)?.country;
  return ca === "IN" && cb === "IN";
}
export type FlightLeg = {
  /** Operating flight IATA code, e.g. "6E622". */
  key: string;
  airline: { iata: string; name: string; icao: string | null };
  number: string;
  from: FlightPoint;
  to: FlightPoint;
  /** Arrival day relative to departure (0 same day, 1 next day). */
  dayOffset: number;
  durationMin: number;
  distanceKm: number;
  aircraft: { code: AircraftCode; name: string; registration: string | null };
  /** Marketing codes of partners that sell this flight ("VS8725"). */
  codeshares: string[];
  /** Today's live status from aviationstack when the search date is today. */
  status?: { state: string; delayMin: number | null; estimated: string | null } | null;
};
export type FareQuote = { perAdultPaise: number; basePaise: number; taxesPaise: number; seatsLeft: number };
export type FlightOption = {
  /** "6E622" or "6E622.AI501" for a connection. */
  id: string;
  legs: FlightLeg[];
  /** Layover minutes between legs (length = legs - 1). */
  layovers: number[];
  stops: number;
  durationMin: number;
  dep: string; arr: string; dayOffset: number;
  fares: Partial<Record<CabinKey, FareQuote>>;
  baggage: Record<CabinKey, { cabin: string; checkIn: string }>;
  refundable: boolean;
};

/* ------------------------------ time helpers ----------------------------- */

export const hhmm = (min: number) => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((min % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** UTC offset (minutes) of an IANA zone on a date — handles DST abroad. */
export function tzOffsetMin(tz: string, isoDate: string) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date(`${isoDate}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
  } catch {
    return 330;
  }
}
export function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
export const slotOfTime = (t: string): "early" | "morning" | "afternoon" | "night" => {
  const m = toMin(t);
  return m < 360 ? "early" : m < 720 ? "morning" : m < 1080 ? "afternoon" : "night";
};

/* --------------------------------- hashing -------------------------------- */

/** FNV-1a → [0, 1). Deterministic so the same flight + date always prices / fills the same way. */
export function rand01(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/* -------------------------------- fare model ------------------------------ */

export type FlightFareSettings = {
  flight_base_fare: string; flight_per_km: string; flight_fullservice_pct: string; flight_business_mult: string; flight_intl_mult: string;
  flight_lastminute_pct: string; flight_peak_pct: string; flight_connection_discount_pct: string;
  flight_airport_fee: string; flight_airport_fee_intl: string; flight_gst_eco_pct: string; flight_gst_biz_pct: string;
};

/** Days-ahead demand curve: closer to departure = dearer. */
function demand(daysAhead: number, lastMinutePct: number) {
  const lm = lastMinutePct / 100;
  if (daysAhead <= 1) return 1 + lm;
  if (daysAhead <= 3) return 1 + lm * 0.7;
  if (daysAhead <= 7) return 1 + lm * 0.4;
  if (daysAhead <= 14) return 1 + lm * 0.15;
  if (daysAhead <= 30) return 1;
  return 0.93;
}

/** Base fare + taxes for ONE adult on ONE leg. */
export function legFare(s: FlightFareSettings, leg: Pick<FlightLeg, "key" | "airline" | "distanceKm" | "from" | "to">, date: string, cabin: CabinKey, today = todayIST()) {
  const intl = !isDomesticPair(leg.from, leg.to);
  const info = airlineInfo(leg.airline.iata);
  let fare = numSetting(s.flight_base_fare, 100000) + leg.distanceKm * numSetting(s.flight_per_km, 1000);
  if (!info.lcc) fare *= 1 + numSetting(s.flight_fullservice_pct, 300) / 100;
  if (intl) fare *= Math.max(1, numSetting(s.flight_intl_mult, 10));
  fare *= demand(Math.max(0, daysBetween(today, date)), numSetting(s.flight_lastminute_pct, 300));
  const dep = toMin(leg.from.time);
  if ((dep >= 360 && dep < 600) || (dep >= 1020 && dep < 1260)) fare *= 1 + numSetting(s.flight_peak_pct, 100) / 100;
  else if (dep < 300) fare *= 0.9; // red-eye
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (wd === 5 || wd === 0) fare *= 1.06;
  fare *= 0.93 + rand01(`${leg.key}|${date}`) * 0.14; // ±7 % so neighbours differ
  if (cabin === "business") fare *= Math.max(1, numSetting(s.flight_business_mult, 10));
  const basePaise = Math.round(fare) * 100;
  const airport = rupeesToPaise(intl ? s.flight_airport_fee_intl : s.flight_airport_fee, 99999);
  const gst = pctOf(basePaise, cabin === "business" ? s.flight_gst_biz_pct : s.flight_gst_eco_pct);
  return { basePaise, taxesPaise: airport + gst, airportPaise: airport, gstPaise: gst };
}

/** Whole option (connections get the admin's connection discount on the base fare). */
export function optionFare(s: FlightFareSettings, legs: FlightLeg[], date: string, cabin: CabinKey, today = todayIST()) {
  let base = 0;
  let airport = 0;
  // every leg is priced on the journey date (the demand curve is per journey, not per leg)
  const parts = legs.map((l) => legFare(s, l, date, cabin, today));
  for (const p of parts) {
    base += p.basePaise;
    airport += p.airportPaise;
  }
  if (legs.length > 1) base = Math.round((base * (100 - numSetting(s.flight_connection_discount_pct, 60))) / 100 / 100) * 100;
  const gst = pctOf(base, cabin === "business" ? s.flight_gst_biz_pct : s.flight_gst_eco_pct);
  return { basePaise: base, airportPaise: airport, gstPaise: gst, perAdultPaise: base + airport + gst };
}

/* ------------------------------- seat model ------------------------------- */

export type FlightSeatSettings = { flight_seat_fee_window: string; flight_seat_fee_aisle: string; flight_seat_fee_middle: string; flight_seat_fee_xl: string; flight_seat_fee_front: string };

/** How full the plane already is (other airlines' / channels' passengers) — rises towards departure. */
export function fillRate(key: string, date: string, today = todayIST()) {
  const d = Math.max(0, daysBetween(today, date));
  const base = d <= 1 ? 0.78 : d <= 3 ? 0.68 : d <= 7 ? 0.56 : d <= 21 ? 0.44 : 0.32;
  return Math.min(0.92, base + (rand01(`fill|${key}|${date}`) - 0.5) * 0.16);
}
export const seatPreTaken = (key: string, date: string, seat: string, rate: number) => rand01(`seat|${key}|${date}|${seat}`) < rate;

export type SeatInfo = { id: string; row: number; letter: string; kind: "window" | "aisle" | "middle"; xl: boolean; exit: boolean; feePaise: number; taken: boolean };

/** Fee for one seat (business seats are included in the fare). */
export function seatFeePaise(s: FlightSeatSettings, cabin: CabinLayout, seat: string) {
  if (cabin.cabin === "business") return 0;
  const p = parseSeat(seat);
  if (!p) return 0;
  if (cabin.xlRows?.includes(p.row) || cabin.exitRows?.includes(p.row)) return rupeesToPaise(s.flight_seat_fee_xl);
  if (p.row < cabin.fromRow + 5) return rupeesToPaise(s.flight_seat_fee_front);
  const k = seatKind(cabin, p.letter);
  return rupeesToPaise(k === "window" ? s.flight_seat_fee_window : k === "aisle" ? s.flight_seat_fee_aisle : s.flight_seat_fee_middle);
}

/** The cabin's seat map for this flight + date; `held` = seats sold / held on SKYO. */
export function seatMap(s: FlightSeatSettings, aircraft: AircraftCode, cabin: CabinKey, key: string, date: string, held: Set<string>, today = todayIST()) {
  const layout = AIRCRAFT[aircraft].cabins.find((c) => c.cabin === cabin);
  if (!layout) return null;
  const rate = fillRate(`${key}|${cabin}`, date, today);
  const seats: SeatInfo[] = seatsOf(layout).map((id) => {
    const p = parseSeat(id)!;
    return {
      id, row: p.row, letter: p.letter, kind: seatKind(layout, p.letter),
      xl: !!layout.xlRows?.includes(p.row), exit: !!layout.exitRows?.includes(p.row),
      feePaise: seatFeePaise(s, layout, id),
      taken: held.has(id) || seatPreTaken(`${key}|${cabin}`, date, id, rate),
    };
  });
  return { layout, seats };
}

export const seatsLeftFor = (aircraft: AircraftCode, cabin: CabinKey, key: string, date: string, today = todayIST()) => {
  const layout = AIRCRAFT[aircraft].cabins.find((c) => c.cabin === cabin);
  if (!layout) return 0;
  const rate = fillRate(`${key}|${cabin}`, date, today);
  return seatsOf(layout).filter((id) => !seatPreTaken(`${key}|${cabin}`, date, id, rate)).length;
};

/* ------------------------------ charge engine ------------------------------ */

export type FlightChargeSettings = FlightFareSettings & FlightSeatSettings & {
  flight_agent_fee: string; flight_agent_gst_pct: string; flight_insurance: string; flight_insurance_fee: string;
  flight_pg_fee_pct: string; flight_pg_gst_pct: string; flight_child_discount_pct: string; flight_infant_fee: string;
};

export type PaxMix = { adults: number; children: number; infants: number };
export type FlightChargeBreakdown = {
  payMode: PayMode; ac: false; count: number; pax?: PaxMix; perPassengerFarePaise: number; insurance: boolean; cabin: CabinKey;
  lines: ChargeLine[]; totalPaise: number; coupon?: CouponApplied | null; couponError?: string;
};

export const flightInsuranceOffered = (s: Pick<FlightChargeSettings, "flight_insurance" | "flight_insurance_fee">) => s.flight_insurance === "on" && rupeesToPaise(s.flight_insurance_fee) > 0;

/** Traveller type by age on the day of booking: infant < 2 (on lap), child 2–11, adult 12+. */
export const paxType = (age: number): "adult" | "child" | "infant" => (age < 2 ? "infant" : age < 12 ? "child" : "adult");
export const childBasePaise = (s: Pick<FlightChargeSettings, "flight_child_discount_pct">, adultBasePaise: number) => Math.round((adultBasePaise * (100 - numSetting(s.flight_child_discount_pct, 90))) / 100);

/** Airfare for a group (before SKYO fees), for "₹X for 2 adults + 1 child" on result cards. */
export function groupAirfarePaise(s: Pick<FlightChargeSettings, "flight_child_discount_pct" | "flight_infant_fee" | "flight_gst_eco_pct" | "flight_gst_biz_pct">, q: { basePaise: number; taxesPaise: number }, mix: PaxMix, cabin: CabinKey) {
  const pct = cabin === "business" ? s.flight_gst_biz_pct : s.flight_gst_eco_pct;
  const airport = Math.max(0, q.taxesPaise - pctOf(q.basePaise, pct));
  const air = q.basePaise * mix.adults + childBasePaise(s, q.basePaise) * mix.children + rupeesToPaise(s.flight_infant_fee) * mix.infants;
  return air + pctOf(air, pct) + airport * (mix.adults + mix.children);
}

/**
 *   base fare               adult fare × adults, child fare (−child %) × children, infant fee × infants
 *   airport fees            UDF / ASF / PSF per seated traveller (infants on lap don't pay)
 *   GST on airfare          5 % economy / 12 % business on all the airfare above
 *   seats                   paid seats picked on the seat map
 *   SKYO service fee        per traveller + GST
 *   travel insurance        per traveller (optional)
 *   coupon, gateway charges shared engine
 */
export function flightCharges(
  s: FlightChargeSettings,
  p: { fare: { basePaise: number; airportPaise: number }; pax: PaxMix; cabin: CabinKey; seatFeesPaise: number; seatNote?: string; payMode: PayMode; insurance: boolean; coupon?: CouponRule | null },
): FlightChargeBreakdown {
  const a = Math.max(0, Math.floor(p.pax.adults));
  const c = Math.max(0, Math.floor(p.pax.children));
  const i = Math.max(0, Math.floor(p.pax.infants));
  const count = a + c + i;
  const seated = a + c;
  const childBase = childBasePaise(s, p.fare.basePaise);
  const infantFee = rupeesToPaise(s.flight_infant_fee);
  const gstPct = p.cabin === "business" ? s.flight_gst_biz_pct : s.flight_gst_eco_pct;
  const lines: ChargeLine[] = [];
  const add = (key: string, label: string, paise: number, note?: string) => paise > 0 && lines.push({ key, label, paise, note });
  const r = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
  add("fare", c || i ? "Base fare · adults" : "Base fare", p.fare.basePaise * a, `${r(p.fare.basePaise)} × ${a}`);
  add("child_fare", `Base fare · children (${numSetting(s.flight_child_discount_pct, 90)}% off)`, childBase * c, `${r(childBase)} × ${c}`);
  add("infant_fee", "Infant fee (on lap, no seat)", infantFee * i, `${r(infantFee)} × ${i}`);
  add("airport_fee", "Airport fees & surcharges", p.fare.airportPaise * seated, `UDF · ASF · PSF × ${seated}`);
  add("fare_gst", `GST on airfare (${numSetting(gstPct, 100)}%)`, pctOf(p.fare.basePaise * a + childBase * c + infantFee * i, gstPct));
  add("seats", "Seat selection", seated ? p.seatFeesPaise : 0, p.seatNote);
  const agent = rupeesToPaise(s.flight_agent_fee) * count;
  add("agent_fee", "SKYO service fee", agent, `₹${(rupeesToPaise(s.flight_agent_fee) / 100).toFixed(2)} × ${count}`);
  add("agent_gst", `GST on service fee (${numSetting(s.flight_agent_gst_pct, 100)}%)`, pctOf(agent, s.flight_agent_gst_pct));
  const insured = p.insurance && flightInsuranceOffered(s);
  add("insurance", "Travel insurance", insured ? rupeesToPaise(s.flight_insurance_fee) * count : 0, `₹${(rupeesToPaise(s.flight_insurance_fee) / 100).toFixed(2)} × ${count}`);
  const fin = finishCharges(lines, count, p.coupon, { pct: s.flight_pg_fee_pct, gstPct: s.flight_pg_gst_pct });
  return { payMode: p.payMode, ac: false, count, pax: { adults: a, children: c, infants: i }, cabin: p.cabin, perPassengerFarePaise: p.fare.basePaise + p.fare.airportPaise + pctOf(p.fare.basePaise, gstPct), insurance: insured, lines: fin.lines, totalPaise: fin.totalPaise, coupon: fin.coupon, couponError: fin.couponError };
}

/* --------------------------------- baggage -------------------------------- */

export function baggageFor(airline: string, intl: boolean): FlightOption["baggage"] {
  const lcc = airlineInfo(airline).lcc;
  return {
    economy: { cabin: "7 kg", checkIn: intl ? (lcc ? "20 kg" : "30 kg") : "15 kg" },
    business: { cabin: "2 × 7 kg", checkIn: intl ? "40 kg" : "35 kg" },
  };
}

export { distanceKm };
