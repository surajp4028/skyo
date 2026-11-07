import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { exec, query, queryOne, transaction } from "./db";
import { ApiError } from "./http";
import type { CouponRule } from "@/lib/train/charges";

/* =====================================================================
 * Coupons — WooCommerce-style.
 *  - percent / fixed amount on base fare, SKYO service fee or total; or zero_service (waive service fee)
 *  - per-user limit, total limit, optional single user (SKYO ID), active window, pause
 *  - usage = 'used' redemptions + 'reserved' ones whose booking is still inside its payment hold
 * ===================================================================== */

export type CouponRow = {
  id: number; code: string; title: string | null; discount_type: "percent" | "fixed" | "zero_service"; value: string; apply_on: "base_fare" | "service_fee" | "total";
  max_discount: string | null; min_order: string | null; service: string; per_user_limit: number | null; total_limit: number | null; user_uid: string | null;
  status: "active" | "paused"; starts_at: Date | null; expires_at: Date | null; is_default: number; used_count: number; created_at: Date; updated_at: Date;
};

export const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");
export const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export const toRule = (c: CouponRow): CouponRule => ({
  code: c.code, type: c.discount_type, value: Number(c.value), applyOn: c.apply_on,
  maxDiscount: c.max_discount != null ? Number(c.max_discount) : null, minOrder: c.min_order != null ? Number(c.min_order) : null,
});

/** Bookings that still hold a coupon: paid, or awaiting payment inside their hold window. */
const LIVE = `(r.status = 'used' OR (r.status = 'reserved' AND b.payment_status <> 'paid' AND b.status = 'pending' AND b.hold_expires_at > UTC_TIMESTAMP()))`;

type Q = <T>(sql: string, params: unknown[]) => Promise<T[]>;
const onConn = (conn: PoolConnection): Q => async <T,>(sql: string, params: unknown[]) => (await conn.query<RowDataPacket[]>(sql, params))[0] as T[];
const onPool: Q = (sql, params) => query(sql, params as never);

async function usage(q: Q, couponId: number, uid?: string) {
  const [row] = await q<{ total: number; mine: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(r.user_uid = ?), 0) AS mine
       FROM coupon_redemptions r JOIN bookings b ON b.booking_ref = r.booking_ref
      WHERE r.coupon_id = ? AND ${LIVE}`,
    [uid ?? "", couponId],
  );
  return { total: Number(row?.total || 0), mine: Number(row?.mine || 0) };
}

function check(c: CouponRow | null | undefined, uid: string, service: string): asserts c is CouponRow {
  if (!c) throw new ApiError(404, "COUPON_INVALID", "This coupon code isn't valid.");
  if (c.status !== "active") throw new ApiError(409, "COUPON_PAUSED", "This coupon isn't active right now.");
  if (c.service !== "all" && c.service !== service) throw new ApiError(409, "COUPON_SERVICE", `This coupon can't be used for ${service} bookings.`);
  if (c.user_uid && c.user_uid !== uid) throw new ApiError(404, "COUPON_INVALID", "This coupon code isn't valid.");
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) throw new ApiError(409, "COUPON_NOT_STARTED", "This coupon isn't active yet.");
  if (c.expires_at && new Date(c.expires_at).getTime() < now) throw new ApiError(409, "COUPON_EXPIRED", "This coupon has expired.");
}

function checkLimits(c: CouponRow, u: { total: number; mine: number }) {
  if (c.total_limit != null && u.total >= c.total_limit) throw new ApiError(409, "COUPON_EXHAUSTED", "This coupon has been fully used.");
  if (c.per_user_limit != null && u.mine >= c.per_user_limit) throw new ApiError(409, "COUPON_USER_LIMIT", `You've already used this coupon ${c.per_user_limit} time${c.per_user_limit > 1 ? "s" : ""}.`);
}

/** Validate a code for this customer (no lock) — for previews and before creating a booking. */
export async function validateCoupon(code: string, uid: string, service: string) {
  const c = await queryOne<CouponRow>("SELECT * FROM coupons WHERE code = ?", [normCode(code)]);
  check(c, uid, service);
  const u = await usage(onPool, c.id, uid);
  checkLimits(c, u);
  return { coupon: c, rule: toRule(c), usesLeftForYou: c.per_user_limit != null ? c.per_user_limit - u.mine : null, remaining: c.total_limit != null ? c.total_limit - u.total : null };
}

/** Atomically re-check limits (row lock) and reserve the coupon for a pending booking. */
export async function reserveCoupon(code: string, uid: string, service: string, bookingRef: string, discountPaise: number) {
  await transaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM coupons WHERE code = ? FOR UPDATE", [normCode(code)]);
    const c = rows[0] as CouponRow | undefined;
    check(c, uid, service);
    checkLimits(c, await usage(onConn(conn), c.id, uid));
    await conn.query("INSERT INTO coupon_redemptions (coupon_id, code, user_uid, booking_ref, discount_paise, status) VALUES (?,?,?,?,?, 'reserved')", [c.id, c.code, uid, bookingRef, discountPaise]);
  });
}

/** Payment captured → the reservation becomes a use. Idempotent. */
export async function markCouponUsed(bookingRef: string) {
  const r = await queryOne<{ id: number; coupon_id: number; status: string }>("SELECT id, coupon_id, status FROM coupon_redemptions WHERE booking_ref = ?", [bookingRef]);
  if (!r || r.status === "used") return;
  const res = await exec("UPDATE coupon_redemptions SET status = 'used', used_at = UTC_TIMESTAMP() WHERE id = ? AND status <> 'used'", [r.id]);
  if (res.affectedRows === 1) await exec("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [r.coupon_id]);
}

export async function releaseCoupon(bookingRef: string) {
  await exec("UPDATE coupon_redemptions SET status = 'released' WHERE booking_ref = ? AND status = 'reserved'", [bookingRef]);
}

/** Coupons this customer can use right now (public ones + ones made just for them). */
export async function availableCoupons(uid: string, service: string) {
  const rows = await query<CouponRow>(
    `SELECT * FROM coupons WHERE status = 'active' AND (service = 'all' OR service = ?) AND (user_uid IS NULL OR user_uid = ?)
        AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP()) AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
      ORDER BY user_uid IS NULL, id DESC`,
    [service, uid],
  );
  const out = [];
  for (const c of rows) {
    const u = await usage(onPool, c.id, uid);
    const remaining = c.total_limit != null ? c.total_limit - u.total : null;
    const mineLeft = c.per_user_limit != null ? c.per_user_limit - u.mine : null;
    if ((remaining ?? 1) <= 0 || (mineLeft ?? 1) <= 0) continue;
    out.push({ ...publicCoupon(c), usesLeftForYou: mineLeft, personal: !!c.user_uid });
  }
  return out;
}

export const publicCoupon = (c: CouponRow) => ({
  code: c.code, title: c.title, type: c.discount_type, value: Number(c.value), applyOn: c.apply_on,
  maxDiscount: c.max_discount != null ? Number(c.max_discount) : null, minOrder: c.min_order != null ? Number(c.min_order) : null, expiresAt: c.expires_at,
});

/* ------------------------------- Admin ------------------------------- */

export async function adminListCoupons(filter: { userUid?: string } = {}) {
  const where = filter.userUid ? "WHERE c.user_uid IS NULL OR c.user_uid = ?" : "";
  const rows = await query<CouponRow & { live_total: number; reserved_now: number; discount_total: number | null; mine: number }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'used') AS live_total,
            (SELECT COUNT(*) FROM coupon_redemptions r JOIN bookings b ON b.booking_ref = r.booking_ref
              WHERE r.coupon_id = c.id AND r.status = 'reserved' AND b.payment_status <> 'paid' AND b.status = 'pending' AND b.hold_expires_at > UTC_TIMESTAMP()) AS reserved_now,
            (SELECT SUM(r.discount_paise) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'used') AS discount_total,
            (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'used' AND r.user_uid = ?) AS mine
       FROM coupons c ${where} ORDER BY c.is_default DESC, c.id DESC`,
    filter.userUid ? [filter.userUid, filter.userUid] : [""],
  );
  return rows.map((c) => ({
    id: c.id, code: c.code, title: c.title, type: c.discount_type, value: Number(c.value), applyOn: c.apply_on,
    maxDiscount: c.max_discount != null ? Number(c.max_discount) : null, minOrder: c.min_order != null ? Number(c.min_order) : null,
    service: c.service, perUserLimit: c.per_user_limit, totalLimit: c.total_limit, userUid: c.user_uid, status: c.status,
    startsAt: c.starts_at, expiresAt: c.expires_at, isDefault: !!c.is_default, createdAt: c.created_at,
    used: Number(c.live_total), reserved: Number(c.reserved_now), remaining: c.total_limit != null ? Math.max(0, c.total_limit - Number(c.live_total) - Number(c.reserved_now)) : null,
    discountGivenPaise: Number(c.discount_total || 0), usedByThisUser: filter.userUid ? Number(c.mine) : undefined,
  }));
}

export async function couponRedemptions(couponId: number) {
  return query<{ booking_ref: string; user_uid: string; discount_paise: number; status: string; created_at: Date; used_at: Date | null; user_id: number | null }>(
    `SELECT r.booking_ref, r.user_uid, r.discount_paise, r.status, r.created_at, r.used_at, u.id AS user_id
       FROM coupon_redemptions r LEFT JOIN users u ON u.uid = r.user_uid WHERE r.coupon_id = ? ORDER BY r.id DESC LIMIT 200`,
    [couponId],
  );
}
