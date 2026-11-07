import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { fetchOrderPayments } from "@/lib/server/payments/razorpay";
import { recordAttempt } from "@/lib/server/payments/attempts";
import { releaseCoupon } from "@/lib/server/coupons";
import { logProvider } from "@/lib/server/payments/log";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import type { TrainBookingDetails } from "@/lib/server/booking/train-booking";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/**
 * POST { reason } — cancel an UNPAID booking (payment pending). Razorpay is asked first so a payment
 * that was just captured isn't lost; any payment that still arrives later is refunded automatically.
 */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const { ref } = await params;
  const a = await requireAdmin("payments.refund");
  const { reason } = await readJson(req, z.object({ reason: z.string().trim().min(3, "Add a short reason").max(200) }));
  const b = await queryOne<{ id: number; user_uid: string; status: string; payment_status: string; pay_order_id: string | null; details_enc: string }>(
    "SELECT id, user_uid, status, payment_status, pay_order_id, details_enc FROM bookings WHERE booking_ref = ?",
    [ref],
  );
  if (!b) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (b.payment_status === "paid" || b.payment_status === "refunded") throw new ApiError(409, "ALREADY_PAID", "This booking is paid — refund it instead of cancelling.");
  if (b.status !== "pending" && b.status !== "cancelled") throw new ApiError(409, "NOT_PENDING", `Only pending bookings can be cancelled (this one is ${b.status}).`);

  if (b.pay_order_id) {
    const pays = await fetchOrderPayments(b.pay_order_id, ref);
    for (const p of pays.items) await recordAttempt({ bookingRef: ref, userUid: b.user_uid, payment: p, source: "reconcile", verified: true });
    if (pays.items.some((p) => p.status === "captured" || p.status === "authorized"))
      throw new ApiError(409, "PAYMENT_FOUND", "Razorpay already has a successful payment for this booking — use “Re-check with Razorpay” instead.");
  }
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails & { cancelled?: { by: string; reason: string; at: string } };
  d.cancelled = { by: `admin:${a.id}`, reason, at: new Date().toISOString() };
  await exec("UPDATE bookings SET status = 'cancelled', hold_expires_at = LEAST(COALESCE(hold_expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), details_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(d)), b.id]);
  await releaseCoupon(ref);
  await logProvider({ bookingRef: ref, provider: "skyo", direction: "inbound", action: "booking.cancelled", outcome: "ok", request: { by: `admin:${a.id}`, reason }, response: { status: "cancelled" } });
  await audit({ actorType: "admin", actorId: a.id, action: "booking.cancelled", targetType: "booking", targetId: ref, ip: getClientIp(req.headers), meta: { reason } });
  return ok({});
});
