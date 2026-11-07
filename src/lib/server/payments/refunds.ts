import "server-only";
import { exec, query, queryOne } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { logProvider } from "./log";
import { fetchPaymentRefunds, fetchRefund, refundPayment, type RzpRefund } from "./razorpay";
import { releaseCoupon } from "../coupons";

/* =====================================================================
 * Refunds (Razorpay POST /v1/payments/{id}/refund).
 *  - automatic, full amount, when a paid booking can't be ticketed
 *  - by an agent (full or partial) from the booking panel
 *  - status kept in sync from the refund.processed / refund.failed webhooks
 * Total refunded can never exceed what was paid.
 * ===================================================================== */

type B = { booking_ref: string; user_uid: string; status: string; payment_status: string; amount_paise: number; pay_payment_id: string | null };

export async function refundedSoFar(ref: string) {
  const r = await queryOne<{ n: number | null }>("SELECT SUM(amount_paise) n FROM refunds WHERE booking_ref = ? AND status <> 'failed'", [ref]);
  return Number(r?.n || 0);
}

export async function createRefund(ref: string, opts: { amountPaise?: number; reason: string; by: string }) {
  const b = await queryOne<B>("SELECT booking_ref, user_uid, status, payment_status, amount_paise, pay_payment_id FROM bookings WHERE booking_ref = ?", [ref]);
  if (!b) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (!b.pay_payment_id || (b.payment_status !== "paid" && b.payment_status !== "refunded")) throw new ApiError(409, "NOT_PAID", "Only paid bookings can be refunded.");
  const done = await refundedSoFar(ref);
  const left = b.amount_paise - done;
  const amount = opts.amountPaise ?? left;
  if (!Number.isInteger(amount) || amount < 100) throw new ApiError(422, "BAD_AMOUNT", "Refund at least ₹1.");
  if (amount > left) throw new ApiError(409, "OVER_REFUND", `Only ₹${(left / 100).toFixed(2)} is left to refund on this booking.`);

  let r: RzpRefund;
  try {
    r = await refundPayment(b.pay_payment_id, amount, { bookingRef: ref, reason: opts.reason, receipt: `RF_${ref}_${done ? "P" : "F"}${Date.now() % 100000}` });
  } catch (e) {
    await exec("INSERT INTO refunds (booking_ref, payment_id, amount_paise, status, reason, initiated_by, data_enc) VALUES (?,?,?,?,?,?,?)", [
      ref, b.pay_payment_id, amount, "failed", opts.reason.slice(0, 200), opts.by.slice(0, 32), await encrypt(JSON.stringify({ error: (e as Error).message })),
    ]);
    throw e;
  }
  await exec("INSERT INTO refunds (booking_ref, payment_id, refund_id, amount_paise, status, reason, initiated_by, data_enc) VALUES (?,?,?,?,?,?,?,?)", [
    ref, b.pay_payment_id, r.id, r.amount, r.status, opts.reason.slice(0, 200), opts.by.slice(0, 32), await encrypt(JSON.stringify(r)),
  ]);
  await syncBookingRefundState(ref);
  return r;
}

/**
 * Booking state follows what Razorpay has actually PROCESSED:
 *   processed ≥ paid → status + payment_status "refunded" (coupon released)
 *   anything less    → booking keeps its status; the panel shows "refund pending" / "partially refunded".
 */
export async function syncBookingRefundState(ref: string) {
  const b = await queryOne<{ amount_paise: number; status: string; ticket_status: string }>("SELECT amount_paise, status, ticket_status FROM bookings WHERE booking_ref = ?", [ref]);
  if (!b) return;
  const processed = Number((await queryOne<{ n: number | null }>("SELECT SUM(amount_paise) n FROM refunds WHERE booking_ref = ? AND status = 'processed'", [ref]))?.n || 0);
  if (processed >= b.amount_paise) {
    await exec("UPDATE bookings SET status = 'refunded', payment_status = 'refunded' WHERE booking_ref = ?", [ref]);
    await releaseCoupon(ref);
  } else if (b.status === "refunded") {
    // e.g. a refund that was counted earlier later failed
    await exec("UPDATE bookings SET status = ?, payment_status = 'paid' WHERE booking_ref = ?", [b.ticket_status === "issued" ? "confirmed" : "failed", ref]);
  }
}

/** Insert or update one Razorpay refund, matched to OUR booking through the payment id. */
async function upsertRefund(r: RzpRefund, by: string) {
  const booking = await queryOne<{ booking_ref: string; amount_paise: number }>("SELECT booking_ref, amount_paise FROM bookings WHERE pay_payment_id = ?", [r.payment_id]);
  if (!booking) return null; // not a SKYO payment
  const existing = await queryOne<{ id: number }>("SELECT id FROM refunds WHERE refund_id = ?", [r.id]);
  if (existing) await exec("UPDATE refunds SET status = ?, amount_paise = ?, data_enc = ? WHERE id = ?", [r.status, r.amount, await encrypt(JSON.stringify(r)), existing.id]);
  else
    await exec("INSERT INTO refunds (booking_ref, payment_id, refund_id, amount_paise, status, reason, initiated_by, data_enc) VALUES (?,?,?,?,?,?,?,?)", [
      booking.booking_ref, r.payment_id, r.id, r.amount, r.status, (r.notes?.reason || "Refunded from the Razorpay Dashboard").slice(0, 200), by, await encrypt(JSON.stringify(r)),
    ]);
  await syncBookingRefundState(booking.booking_ref);
  return booking.booking_ref;
}

/**
 * Webhook refund.created / refund.processed / refund.failed. The body is signature-checked by the route;
 * we still re-read the refund from Razorpay's API before trusting its status (double validation).
 */
export async function updateRefundFromWebhook(r: RzpRefund) {
  if (!r?.id || !r.payment_id) return false;
  const fresh = await fetchRefund(r.payment_id, r.id).catch(() => null);
  if (!fresh || fresh.payment_id !== r.payment_id) return false;
  return !!(await upsertRefund(fresh, "razorpay"));
}

/** Pull every refund Razorpay has for this booking's payment (dashboard refunds included). */
export async function syncRefundsForBooking(ref: string) {
  const b = await queryOne<{ pay_payment_id: string | null }>("SELECT pay_payment_id FROM bookings WHERE booking_ref = ?", [ref]);
  if (!b?.pay_payment_id) return 0;
  const list = await fetchPaymentRefunds(b.pay_payment_id, ref);
  for (const r of list.items) await upsertRefund(r, "razorpay");
  return list.count;
}

/** One status word for lists: none | pending | partial | refunded */
export function refundState(paidPaise: number, processed: number, pending: number) {
  if (processed >= paidPaise && paidPaise > 0) return "refunded" as const;
  if (pending > 0) return "pending" as const;
  if (processed > 0) return "partial" as const;
  return "none" as const;
}

/** Called when a paid booking couldn't be ticketed. Never throws — failures are logged for the team. */
export async function autoRefundFailedBooking(ref: string, reason: string) {
  try {
    await createRefund(ref, { reason: `Ticket not issued: ${reason}`.slice(0, 200), by: "system" });
  } catch (e) {
    await logProvider({ bookingRef: ref, provider: "skyo", direction: "outbound", action: "refund.auto_failed", outcome: "error", request: { reason }, response: { error: (e as Error).message } });
  }
}

export async function listRefunds(ref: string) {
  const rows = await query<{ id: number; refund_id: string | null; amount_paise: number; status: string; reason: string | null; initiated_by: string; created_at: Date; updated_at: Date; data_enc: string | null }>(
    "SELECT id, refund_id, amount_paise, status, reason, initiated_by, created_at, updated_at, data_enc FROM refunds WHERE booking_ref = ? ORDER BY id",
    [ref],
  );
  return Promise.all(
    rows.map(async ({ data_enc, ...r }) => {
      let data: unknown = null;
      try {
        data = data_enc ? JSON.parse(await decrypt(data_enc)) : null;
      } catch {}
      return { ...r, data };
    }),
  );
}
