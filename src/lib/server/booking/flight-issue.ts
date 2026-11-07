import "server-only";
import crypto from "node:crypto";
import { exec, queryOne, transaction } from "../db";
import { decrypt, encOpt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { logProvider } from "../payments/log";
import { autoRefundFailedBooking } from "../payments/refunds";
import { afterTicketIssued, notifyFailure } from "./post-issue";
import { holdSeats, seatMapFor } from "../flight/seats";
import type { FlightBookingDetails } from "./flight-booking";

/* =====================================================================
 * Flight ticketing through Tripgic. TRIPGIC_MODE=mock (default) returns a realistic SAMPLE
 * ticket (PNR, e-ticket numbers, seats) so the whole flow can be tested end to end.
 * When Tripgic's flight API is available, replace mockFlight() — callers don't change.
 * ===================================================================== */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const pnr = () => Array.from({ length: 6 }, () => PNR_CHARS[crypto.randomInt(PNR_CHARS.length)]).join("");
/** IATA ticket number: 3-digit airline accounting code + 10 digits. */
const ACCOUNTING: Record<string, string> = { AI: "098", "6E": "312", QP: "348", SG: "775", IX: "751", UK: "228", "9I": "058", EK: "176", QR: "157", SQ: "618" };

async function mockFlight(ref: string, d: FlightBookingDetails) {
  const record = pnr();
  const airlinePnrs = Object.fromEntries(d.flight.legs.map((l) => [l.key, l.airline.iata === d.flight.legs[0].airline.iata ? record : pnr()]));
  // seats the customer didn't pick are auto-assigned (free seats, rows from the back like airlines do)
  const auto: { key: string; seat: string; pax: number }[] = [];
  for (const leg of d.flight.legs) {
    const map = await seatMapFor(leg.key, d.date, leg.aircraft.code, d.flight.cabin);
    const free = (map?.seats || []).filter((s) => !s.taken && s.feePaise === 0).reverse();
    const used = new Set(d.passengers.map((p) => p.seats[leg.key]).filter(Boolean) as string[]);
    d.passengers.forEach((p, i) => {
      if (p.seats[leg.key] || p.type === "infant") return;
      const s = free.find((x) => !used.has(x.id));
      if (s) {
        used.add(s.id);
        auto.push({ key: leg.key, seat: s.id, pax: i });
      }
    });
  }
  return {
    pnr: record,
    ticketNo: "TG" + crypto.randomInt(10_000_000, 99_999_999),
    airlinePnrs,
    auto,
    allocations: d.passengers.map((p, i) => {
      const seats: Record<string, string> = {};
      for (const l of d.flight.legs) seats[l.key] = p.type === "infant" ? "On lap" : p.seats[l.key] || auto.find((a) => a.key === l.key && a.pax === i)?.seat || "At check-in";
      const code = ACCOUNTING[d.flight.legs[0].airline.iata] || String(crypto.randomInt(100, 999));
      return { name: p.name, age: p.age, gender: p.gender, type: p.type, status: "CNF", eticket: `${code}-${crypto.randomInt(1_000_000_000, 9_999_999_999)}`, seats, berthType: Object.values(seats).join(" / ") };
    }),
  };
}

/** Ticket a PAID flight booking (first try after payment, or an agent's "Retry ticketing"). */
export async function issueFlightForBooking(ref: string, opts: { autoRefund: boolean }) {
  const b = await queryOne<{ id: number; booking_ref: string; payment_status: string; pay_payment_id: string | null; ticket_status: string; amount_paise: number; details_enc: string }>(
    "SELECT id, booking_ref, payment_status, pay_payment_id, ticket_status, amount_paise, details_enc FROM bookings WHERE booking_ref = ? AND service = 'flight'",
    [ref],
  );
  if (!b || b.payment_status !== "paid" || !b.pay_payment_id) throw new ApiError(409, "NOT_PAID", "Only paid bookings can be ticketed.");
  if (b.ticket_status === "issued") return { ok: true as const, already: true };
  const d = JSON.parse(await decrypt(b.details_enc)) as FlightBookingDetails;
  const mode = (process.env.TRIPGIC_MODE || "mock").toLowerCase();
  const started = Date.now();
  const request = {
    endpoint: mode === "mock" ? "mock://tripgic/flights/tickets" : `${process.env.TRIPGIC_BASE_URL}/flights/tickets`,
    body: {
      bookingRef: ref, date: d.date, cabin: d.flight.cabin,
      segments: d.flight.legs.map((l) => ({ flight: l.key, from: l.from.iata, to: l.to.iata, dep: l.from.time, arr: l.to.time })),
      passengers: d.passengers, paymentId: b.pay_payment_id, amountPaise: b.amount_paise, billingState: d.billing?.state ?? null, gstin: d.gst?.gstin ?? null,
    },
  };
  try {
    if (mode !== "mock") throw new Error("Tripgic live mode is not implemented yet — set TRIPGIC_MODE=mock or add the flight API integration");
    const t = await mockFlight(ref, d);
    if (t.auto.length) await transaction((conn) => holdSeats(conn, ref, d.date, d.flight.cabin, t.auto)).catch(() => {});
    await logProvider({ bookingRef: ref, provider: "tripgic", direction: "outbound", action: "flight.ticket.issue", httpStatus: 200, outcome: "ok", externalId: t.pnr, amountPaise: b.amount_paise, latencyMs: Date.now() - started, request, response: { mode: "mock", ...t } });
    d.ticket = { pnr: t.pnr, ticketNo: t.ticketNo, chartStatus: "Confirmed", airlinePnrs: t.airlinePnrs, allocations: t.allocations, issuedAt: new Date().toISOString(), provider: mode === "mock" ? "tripgic-mock" : "tripgic" };
    delete d.failure;
    await exec("UPDATE bookings SET status = 'confirmed', ticket_status = 'issued', pnr_enc = ?, issued_at = UTC_TIMESTAMP(), provider_ref_enc = ?, details_enc = ? WHERE id = ?", [
      await encrypt(t.pnr), await encOpt(t.ticketNo), await encrypt(JSON.stringify(d)), b.id,
    ]);
  } catch (e) {
    d.failure = (e as Error).message;
    await logProvider({ bookingRef: ref, provider: "tripgic", direction: "outbound", action: "flight.ticket.issue", outcome: "error", latencyMs: Date.now() - started, request, response: { error: d.failure } });
    await exec("UPDATE bookings SET status = 'failed', ticket_status = 'failed', details_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(d)), b.id]);
    if (opts.autoRefund) {
      await autoRefundFailedBooking(ref, d.failure);
      void notifyFailure(ref).catch(() => {});
    }
    return { ok: false as const, error: d.failure };
  }
  void afterTicketIssued(ref, null).catch((e) => console.error("[post-issue]", (e as Error).message));
  return { ok: true as const };
}
