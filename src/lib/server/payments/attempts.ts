import "server-only";
import { exec, query } from "../db";
import { decrypt, encrypt } from "../crypto";
import type { RzpPayment } from "./razorpay";

/**
 * One row per Razorpay payment id (each try in the checkout = a new payment id).
 * `verified` = the data came from Razorpay itself (API fetch / signed webhook), not the browser.
 * A verified update always wins over a client-reported one.
 */
export async function recordAttempt(a: {
  bookingRef: string; userUid: string; payment: Partial<RzpPayment> & { id?: string; error_reason?: string | null };
  source: "checkout" | "webhook" | "client" | "reconcile"; verified: boolean;
}) {
  const p = a.payment;
  if (!p.id) return;
  const errDesc = (p.error_description || null)?.slice(0, 300) ?? null;
  await exec(
    `INSERT INTO payment_attempts (booking_ref, user_uid, provider, order_id, payment_id, status, method, amount_paise, error_code, error_desc, verified, source, data_enc)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       status = IF(VALUES(verified) >= verified, VALUES(status), status),
       method = COALESCE(VALUES(method), method),
       amount_paise = COALESCE(VALUES(amount_paise), amount_paise),
       error_code = IF(VALUES(verified) >= verified, VALUES(error_code), error_code),
       error_desc = IF(VALUES(verified) >= verified, VALUES(error_desc), error_desc),
       source = IF(VALUES(verified) >= verified, VALUES(source), source),
       data_enc = IF(VALUES(verified) >= verified, VALUES(data_enc), data_enc),
       verified = GREATEST(verified, VALUES(verified))`,
    [
      a.bookingRef, a.userUid, "razorpay", p.order_id ?? null, p.id, (p.status || "unknown").slice(0, 16), p.method?.slice(0, 24) ?? null,
      typeof p.amount === "number" ? p.amount : null, p.error_code?.slice(0, 64) ?? null, errDesc, a.verified ? 1 : 0, a.source, await encrypt(JSON.stringify(p)),
    ],
  );
}

type Row = { id: number; booking_ref: string; order_id: string | null; payment_id: string | null; status: string; method: string | null; amount_paise: number | null; error_code: string | null; error_desc: string | null; verified: number; source: string; created_at: Date; updated_at: Date; data_enc?: string | null };

/** Customer view — no raw provider payload. */
export async function listUserAttempts(uid: string) {
  const rows = await query<Row & { service: string; title_enc: string | null }>(
    `SELECT a.id, a.booking_ref, a.order_id, a.payment_id, a.status, a.method, a.amount_paise, a.error_code, a.error_desc, a.verified, a.source, a.created_at, a.updated_at,
            b.service, b.title_enc
       FROM payment_attempts a LEFT JOIN bookings b ON b.booking_ref = a.booking_ref
      WHERE a.user_uid = ? ORDER BY a.id DESC LIMIT 100`,
    [uid],
  );
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id, bookingRef: r.booking_ref, paymentId: r.payment_id, orderId: r.order_id, status: r.status, method: r.method,
      amount: r.amount_paise != null ? r.amount_paise / 100 : null, error: r.error_desc, verified: !!r.verified, at: r.created_at, updatedAt: r.updated_at,
      service: r.service, title: (await decrypt(r.title_enc)) || null,
    })),
  );
}

/** Admin view — full Razorpay payment object as last received. */
export async function listBookingAttempts(ref: string) {
  const rows = await query<Row>(
    "SELECT id, booking_ref, order_id, payment_id, status, method, amount_paise, error_code, error_desc, verified, source, created_at, updated_at, data_enc FROM payment_attempts WHERE booking_ref = ? ORDER BY id",
    [ref],
  );
  return Promise.all(
    rows.map(async (r) => {
      let data: unknown = null;
      try {
        data = r.data_enc ? JSON.parse(await decrypt(r.data_enc)) : null;
      } catch {}
      return { id: r.id, paymentId: r.payment_id, orderId: r.order_id, status: r.status, method: r.method, amount: r.amount_paise, errorCode: r.error_code, error: r.error_desc, verified: !!r.verified, source: r.source, at: r.created_at, updatedAt: r.updated_at, data };
    }),
  );
}
