import "server-only";
import crypto from "node:crypto";
import { exec, query, queryOne, sqlDate } from "../db";
import { decrypt, encrypt, encOpt } from "../crypto";
import { ApiError } from "../http";
import { getAllSettings, getSetting } from "../settings";
import { seatAvailability } from "../train/service";
import type { ClassCode, Quota } from "../train/types";
import { getPassengersByIds, type Passenger } from "./passengers";
import { capturePayment, createOrder, fetchPayment, razorpayKeyId, type RzpPayment } from "../payments/razorpay";
import { logProvider } from "../payments/log";
import { issueTicket, type IssueResult } from "./tripgic";
import { loadMe } from "../me";
import { trainCharges, type ChargeBreakdown, type PayMode } from "@/lib/train/charges";
import { recordAttempt } from "../payments/attempts";
import { afterTicketIssued } from "./post-issue";
import { markCouponUsed, reserveCoupon, validateCoupon } from "../coupons";
import { autoRefundFailedBooking } from "../payments/refunds";
import { notifyFailure } from "./post-issue";
import { getUserGst, saveBilling, type Billing } from "../gst";

const HOLD_MINUTES = 15;
const BOOKABLE = new Set(["AVAILABLE", "RAC", "WAITLIST"]);

export type TrainBookingDetails = {
  train: { number: string; name: string };
  from: string; to: string; date: string; cls: ClassCode; quota: Quota;
  food: boolean;
  passengers: Omit<Passenger, "id">[];
  pricing: { baseFare: number; catering: number; perPassenger: number; count: number; total: number; currency: "INR" };
  /** Full server-side charge breakdown (fare, IRCTC fee, service fee, insurance, gateway). */
  charges?: ChargeBreakdown;
  payMode?: PayMode;
  insurance?: { opted: boolean; perPassenger: number; total: number; status: "pending_policy" | "not_opted" };
  /** Billing state (sent to IRCTC/Tripgic; decides IGST vs CGST+SGST on invoices). */
  billing?: Billing | null;
  /** GST details snapshot used for the tax invoice (only if the customer chose to use them). */
  gst?: { gstin: string; company: string; address: string | null; pincode: string | null; state: string | null } | null;
  /** Where to email the e-ticket when the account has no email. */
  notifyEmail?: string | null;
  /** IRCTC "consider for auto upgradation" preference. */
  autoUpgrade?: boolean;
  /** Set when the customer paid with a method other than the one priced (UPI vs card). */
  methodMismatch?: { priced: PayMode; paidWith: string };
  availability: { status: string; text: string; checkedAt: string | null };
  contact: { name: string | null; email: string | null; phone: string | null };
  ticket?: Omit<IssueResult, "ticketPdfBase64"> & { issuedAt: string; provider: string; providerPdfKey?: string | null };
  failure?: string;
};

const newRef = () => "SKT" + crypto.randomInt(10_000_000, 100_000_000);

/**
 * Step 1 — price on the SERVER from live RailCore availability (never from the browser),
 * store a pending booking, create the Razorpay order for exactly that amount.
 */
export async function initiateTrainBooking(
  user: { id: number; uid: string },
  p: { train: string; trainName: string; from: string; to: string; date: string; cls: ClassCode; quota: Quota; passengerIds: number[]; food: boolean; payMode: PayMode; insurance: boolean; couponCode?: string | null; billing?: Billing | null; useGst?: boolean; autoUpgrade?: boolean; notifyEmail?: string | null },
) {
  const maxPax = Math.min(6, Math.max(1, parseInt(await getSetting("max_passengers_per_booking"), 10) || 6));
  const cap = p.quota === "TQ" || p.quota === "PT" ? Math.min(4, maxPax) : maxPax;
  const ids = [...new Set(p.passengerIds)];
  if (ids.length < 1) throw new ApiError(422, "NO_PASSENGERS", "Select at least one traveller.");
  if (ids.length > cap) throw new ApiError(422, "TOO_MANY_PASSENGERS", `You can book up to ${cap} travellers${cap === 4 ? " in Tatkal" : ""}.`);
  const pax = await getPassengersByIds(user.id, ids);
  const young = pax.find((x) => x.age < 5);
  if (young) throw new ApiError(422, "CHILD_UNDER_5", `${young.name} is under 5 — children under 5 travel free without a berth and shouldn't be added.`);

  // coupon first — an invalid code must not cost RailCore credits
  const coupon = p.couponCode ? await validateCoupon(p.couponCode, user.uid, "train") : null;

  // live, authoritative fare
  const av = await seatAvailability({ train: p.train, from: p.from, to: p.to, date: p.date, cls: p.cls, quota: p.quota }, { userId: user.id });
  const cls = av.data.classes.find((c) => c.class_code === p.cls) || av.data.classes[0];
  if (!cls || !BOOKABLE.has(cls.status)) throw new ApiError(409, "NOT_BOOKABLE", `This class can't be booked right now (${cls?.availability_text || "not available"}).`);
  const baseFare = Number(cls.fare ?? 0);
  const catering = Number(cls.catering_charge ?? 0);
  if (!(baseFare > 0)) throw new ApiError(409, "NO_FARE", "Fare is not available for this class right now. Please try again.");
  const perPassenger = p.food && catering > 0 ? Number(cls.total_fare ?? baseFare + catering) : baseFare;
  const charges = trainCharges(await getAllSettings(), { perPassengerFare: perPassenger, count: pax.length, cls: p.cls, payMode: p.payMode, insurance: p.insurance, coupon: coupon?.rule ?? null });
  if (coupon && !charges.coupon) throw new ApiError(409, "COUPON_NOT_APPLICABLE", charges.couponError || "This coupon can't be applied to this booking.");
  const total = charges.totalPaise; // integer paise — the ONLY amount that goes to Razorpay
  const ins = charges.lines.find((l) => l.key === "insurance");
  const me = await loadMe(user.id);
  if (p.billing) await saveBilling(user.id, p.billing); // remembered for next time
  const gst = p.useGst ? await getUserGst(user.id) : null;

  const details: TrainBookingDetails = {
    train: { number: p.train, name: p.trainName.slice(0, 80) },
    from: p.from, to: p.to, date: p.date, cls: p.cls, quota: p.quota, food: p.food && catering > 0,
    passengers: pax.map((x) => ({ name: x.name, age: x.age, gender: x.gender, berth: x.berth ?? null, nationality: x.nationality })),
    pricing: { baseFare, catering, perPassenger, count: pax.length, total: total / 100, currency: "INR" },
    charges,
    payMode: p.payMode,
    insurance: ins ? { opted: true, perPassenger: ins.paise / 100 / pax.length, total: ins.paise / 100, status: "pending_policy" } : { opted: false, perPassenger: 0, total: 0, status: "not_opted" },
    availability: { status: cls.status, text: cls.availability_text, checkedAt: av.data.enquiry_checked_at ?? null },
    contact: { name: me?.name ?? null, email: me?.email ?? null, phone: me?.phone ?? null },
    billing: p.billing ?? null,
    gst: gst ? { gstin: gst.gstin, company: gst.company, address: gst.address, pincode: gst.pincode, state: gst.state } : null,
    autoUpgrade: p.autoUpgrade ?? true,
    notifyEmail: me?.email ? null : p.notifyEmail || null,
  };

  let ref = newRef();
  for (let i = 0; i < 4; i++) {
    try {
      await exec(
        `INSERT INTO bookings (booking_ref, user_uid, service, status, payment_status, title_enc, origin_enc, destination_enc, details_enc, provider,
                               travel_date, travellers, amount_paise, currency, pay_provider, charges_enc, hold_expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
        [ref, user.uid, "train", "pending", "unpaid", await encrypt(`${p.trainName} · ${p.train}`), await encrypt(p.from), await encrypt(p.to),
         await encrypt(JSON.stringify(details)), "railcore", p.date, pax.length, total, "INR", "razorpay", await encrypt(JSON.stringify(charges)), HOLD_MINUTES],
      );
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY" && i < 3) {
        ref = newRef();
        continue;
      }
      throw e;
    }
  }

  if (charges.coupon) {
    try {
      await reserveCoupon(charges.coupon.code, user.uid, "train", ref, charges.coupon.discountPaise);
    } catch (e) {
      await exec("UPDATE bookings SET status = 'failed' WHERE booking_ref = ?", [ref]);
      throw e;
    }
  }

  const order = await createOrder({
    amountPaise: total,
    receipt: `SKYO_${ref}`,
    bookingRef: ref,
    notes: { booking_ref: ref, user: user.uid, service: "train", train: p.train, class: p.cls, date: p.date, passengers: String(pax.length), pay_mode: p.payMode, insurance: ins ? "yes" : "no", coupon: charges.coupon?.code ?? "" },
  });
  await exec("UPDATE bookings SET pay_order_id = ? WHERE booking_ref = ?", [order.id, ref]);
  return { bookingRef: ref, order, details };
}

export function checkoutOptions(ref: string, orderId: string, amountPaise: number, d: TrainBookingDetails, siteName: string) {
  return {
    key: razorpayKeyId(),
    order_id: orderId,
    amount: amountPaise,
    currency: "INR",
    name: siteName,
    description: `${d.train.number} ${d.from}→${d.to} · ${d.cls} · ${d.pricing.count} pax`.slice(0, 250),
    prefill: { name: d.contact.name || "", email: d.contact.email || "", contact: (d.contact.phone || "").replace(/\s/g, "") },
    notes: { booking_ref: ref },
    theme: { color: "#0057ff" },
    // The IRCTC fee depends on UPI vs Card/NetBanking, so only the priced methods are offered.
    config: {
      display: {
        hide: d.payMode === "upi"
          ? [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }, { method: "emi" }, { method: "paylater" }, { method: "cardless_emi" }]
          : d.payMode === "card"
            ? [{ method: "upi" }, { method: "wallet" }, { method: "emi" }, { method: "paylater" }, { method: "cardless_emi" }]
            : [],
        preferences: { show_default_blocks: true },
      },
    },
  };
}

type Row = { id: number; booking_ref: string; user_uid: string; status: string; payment_status: string; amount_paise: number; pay_order_id: string | null; pay_payment_id: string | null; details_enc: string; ticket_status: string; hold_expires_at: Date | null };

const rowByRef = (ref: string) => queryOne<Row>("SELECT id, booking_ref, user_uid, status, payment_status, amount_paise, pay_order_id, pay_payment_id, details_enc, ticket_status, hold_expires_at FROM bookings WHERE booking_ref = ?", [ref]);
const rowByOrder = (orderId: string) => queryOne<Row>("SELECT id, booking_ref, user_uid, status, payment_status, amount_paise, pay_order_id, pay_payment_id, details_enc, ticket_status, hold_expires_at FROM bookings WHERE pay_order_id = ?", [orderId]);

export async function bookingForUser(ref: string, uid: string) {
  const r = await rowByRef(ref);
  if (!r || r.user_uid !== uid) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  return { ...r, details: JSON.parse(await decrypt(r.details_enc)) as TrainBookingDetails };
}

/**
 * Step 2 — a payment is reported (checkout handler or webhook). We trust only Razorpay's
 * own payment record: right order, right amount, captured. Runs once per booking.
 */
export async function confirmPayment(orderId: string, payment: RzpPayment, via: "checkout" | "webhook") {
  const b = await rowByOrder(orderId);
  if (!b) return { ok: false as const, reason: "UNKNOWN_ORDER" };
  if (payment.order_id !== orderId) return { ok: false as const, reason: "ORDER_MISMATCH" };

  let p = payment;
  if (p.status === "authorized") p = await capturePayment(p.id, b.amount_paise, b.booking_ref);
  await recordAttempt({ bookingRef: b.booking_ref, userUid: b.user_uid, payment: p, source: via, verified: true });
  if (p.status !== "captured") {
    if (p.status === "failed") await exec("UPDATE bookings SET payment_status = 'failed' WHERE id = ? AND payment_status = 'unpaid'", [b.id]);
    return { ok: false as const, reason: `PAYMENT_${p.status.toUpperCase()}`, bookingRef: b.booking_ref };
  }
  if (Number(p.amount) !== Number(b.amount_paise) || p.currency !== "INR") {
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "inbound", action: "amount.mismatch", outcome: "error", amountPaise: p.amount, request: { via, expected: b.amount_paise }, response: { got: p.amount, currency: p.currency } });
    const r = await exec("UPDATE bookings SET status = 'failed', payment_status = 'paid', pay_payment_id = ?, paid_at = UTC_TIMESTAMP() WHERE id = ? AND payment_status <> 'paid'", [p.id, b.id]);
    if (r.affectedRows === 1) await autoRefundFailedBooking(b.booking_ref, "amount mismatch");
    return { ok: false as const, reason: "AMOUNT_MISMATCH", bookingRef: b.booking_ref };
  }

  // idempotency gate: only the first caller proceeds to ticketing
  const won = await exec("UPDATE bookings SET payment_status = 'paid', pay_payment_id = ?, paid_at = ? WHERE id = ? AND payment_status <> 'paid'", [p.id, sqlDate(), b.id]);
  if (won.affectedRows !== 1) return { ok: true as const, bookingRef: b.booking_ref, already: true };
  await markCouponUsed(b.booking_ref);
  await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "inbound", action: `payment.confirmed.${via}`, outcome: "ok", externalId: p.id, amountPaise: p.amount, request: { order_id: orderId, payment_id: p.id }, response: { status: p.status, method: p.method } });

  const details = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const paidUpi = p.method === "upi";
  if (details.payMode && (details.payMode === "upi") !== paidUpi) details.methodMismatch = { priced: details.payMode, paidWith: p.method || "unknown" };
  await exec("UPDATE bookings SET details_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(details)), b.id]);
  await issueForBooking(b.booking_ref, { autoRefund: true });
  return { ok: true as const, bookingRef: b.booking_ref };
}

/**
 * Issue the ticket for a PAID booking (first try after payment, or an agent's "Retry ticketing").
 * On failure the booking is marked failed and — when autoRefund — the full amount is refunded.
 */
export async function issueForBooking(ref: string, opts: { autoRefund: boolean }) {
  const b = await rowByRef(ref);
  if (!b || b.payment_status !== "paid" || !b.pay_payment_id) throw new ApiError(409, "NOT_PAID", "Only paid bookings can be ticketed.");
  if (b.ticket_status === "issued") return { ok: true as const, already: true };
  const details = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  let providerPdf: Buffer | null = null;
  try {
    const t = await issueTicket({
      bookingRef: b.booking_ref, train: details.train, from: details.from, to: details.to, date: details.date, cls: details.cls, quota: details.quota,
      passengers: details.passengers, availability: details.availability, paymentId: b.pay_payment_id, amountPaise: b.amount_paise,
      autoUpgrade: details.autoUpgrade ?? true, billingState: details.billing?.state ?? null, gstin: details.gst?.gstin ?? null,
    });
    const { ticketPdfBase64, ...tk } = t;
    if (ticketPdfBase64) providerPdf = Buffer.from(ticketPdfBase64, "base64");
    details.ticket = { ...tk, issuedAt: new Date().toISOString(), provider: (process.env.TRIPGIC_MODE || "mock") === "mock" ? "tripgic-mock" : "tripgic" };
    delete details.failure;
    await exec("UPDATE bookings SET status = 'confirmed', ticket_status = 'issued', pnr_enc = ?, issued_at = UTC_TIMESTAMP(), provider_ref_enc = ?, details_enc = ? WHERE id = ?", [
      await encrypt(t.pnr), await encOpt(t.ticketNo), await encrypt(JSON.stringify(details)), b.id,
    ]);
  } catch (e) {
    details.failure = (e as Error).message;
    await exec("UPDATE bookings SET status = 'failed', ticket_status = 'failed', details_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(details)), b.id]);
    if (opts.autoRefund) {
      await autoRefundFailedBooking(b.booking_ref, details.failure);
      void notifyFailure(b.booking_ref).catch(() => {});
    }
    return { ok: false as const, error: details.failure };
  }
  // PDF → S3, SMS, email. Runs after the response path; failures are logged, never block the booking.
  void afterTicketIssued(b.booking_ref, providerPdf).catch((e) => console.error("[post-issue]", (e as Error).message));
  return { ok: true as const };
}

/** Checkout handler path: payment id from the browser → re-read it from Razorpay. */
export async function confirmFromCheckout(orderId: string, paymentId: string, bookingRef?: string) {
  return confirmPayment(orderId, await fetchPayment(paymentId, bookingRef), "checkout");
}

/**
 * Unpaid bookings whose 15-min hold ended (+30 min grace for in-flight payments) become "cancelled".
 * A payment that still arrives later is handled normally by confirmPayment (ticket or auto-refund).
 */
export async function expireStaleHolds() {
  await exec("UPDATE bookings SET status = 'cancelled' WHERE status = 'pending' AND payment_status = 'unpaid' AND hold_expires_at < UTC_TIMESTAMP() - INTERVAL 30 MINUTE");
}

export async function listUserBookings(uid: string, service = "") {
  await expireStaleHolds();
  const rows = await query<Row & { created_at: Date; pnr_enc: string | null; service: string; refunded: number | null; refund_pending: number }>(
    `SELECT id, booking_ref, user_uid, service, status, payment_status, amount_paise, pay_order_id, pay_payment_id, details_enc, ticket_status, hold_expires_at, pnr_enc, created_at,
            (SELECT SUM(r.amount_paise) FROM refunds r WHERE r.booking_ref = bookings.booking_ref AND r.status <> 'failed') AS refunded,
            (SELECT COUNT(*) FROM refunds r WHERE r.booking_ref = bookings.booking_ref AND r.status = 'pending') AS refund_pending
       FROM bookings WHERE user_uid = ? AND (? = '' OR service = ?) ORDER BY id DESC LIMIT 100`,
    [uid, service, service],
  );
  return Promise.all(
    rows.map(async (r) => {
      const d = JSON.parse(await decrypt(r.details_enc)) as TrainBookingDetails;
      return {
        ref: r.booking_ref, service: r.service, status: r.status, paymentStatus: r.payment_status, ticketStatus: r.ticket_status,
        amount: r.amount_paise / 100, createdAt: r.created_at, holdExpiresAt: r.hold_expires_at, pnr: (await decrypt(r.pnr_enc)) || null,
        train: d.train, from: d.from, to: d.to, date: d.date, cls: d.cls, quota: d.quota, food: d.food, passengers: d.passengers,
        pricing: d.pricing, availability: d.availability, charges: d.charges ?? null, insurance: d.insurance ?? null, payMode: d.payMode ?? null,
        ticket: d.ticket ? { ...d.ticket, providerPdfKey: undefined, hasProviderPdf: !!d.ticket.providerPdfKey } : null,
        gst: d.gst ? { gstin: d.gst.gstin, company: d.gst.company } : null,
        refund: r.refunded ? { amount: Number(r.refunded) / 100, pending: Number(r.refund_pending) > 0 } : null,
        failure: r.ticket_status === "failed" ? "We couldn't confirm this ticket." : null,
      };
    }),
  );
}
