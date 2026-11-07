import "server-only";
import { exec, query, queryOne } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { logProvider } from "./log";
import { refundPayment, type RzpRefund } from "./razorpay";
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

/** Full refund → booking + payment "refunded". Partial → stays as is (shown in the panel). */
export async function syncBookingRefundState(ref: string) {
  const b = await queryOne<{ amount_paise: number }>("SELECT amount_paise FROM bookings WHERE booking_ref = ?", [ref]);
  if (!b) return;
  if ((await refundedSoFar(ref)) >= b.amount_paise) {
    await exec("UPDATE bookings SET status = 'refunded', payment_status = 'refunded' WHERE booking_ref = ?", [ref]);
    await releaseCoupon(ref);
  }
}

/** Webhook refund.* → update our row. */
export async function updateRefundFromWebhook(r: RzpRefund) {
  const row = await queryOne<{ booking_ref: string }>("SELECT booking_ref FROM refunds WHERE refund_id = ?", [r.id]);
  if (!row) return false;
  await exec("UPDATE refunds SET status = ?, data_enc = ? WHERE refund_id = ?", [r.status, await encrypt(JSON.stringify(r)), r.id]);
  await syncBookingRefundState(row.booking_ref);
  return true;
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
