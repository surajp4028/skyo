import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { fetchOrderPayments } from "@/lib/server/payments/razorpay";
import { syncRefundsForBooking } from "@/lib/server/payments/refunds";
import { recordAttempt } from "@/lib/server/payments/attempts";
import { confirmPayment } from "@/lib/server/booking/train-booking";
import { audit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/**
 * Admin "Re-check with Razorpay": asks Razorpay for every payment on this booking's order
 * (GET /v1/orders/{id}/payments), stores each attempt, and confirms the booking if a captured
 * payment exists that SKYO missed (e.g. webhook not delivered). Idempotent.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { service, ref } = await params;
  if (service !== "train" && service !== "flight") throw new ApiError(400, "UNSUPPORTED", "Only train and flight bookings can be reconciled right now.");
  const a = await requireAdmin(service === "flight" ? "bookings.flight" : "bookings.train");
  const b = await queryOne<{ booking_ref: string; user_uid: string; pay_order_id: string | null; payment_status: string }>(
    "SELECT booking_ref, user_uid, pay_order_id, payment_status FROM bookings WHERE booking_ref = ? AND service = ?",
    [ref, service],
  );
  if (!b) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (!b.pay_order_id) throw new ApiError(409, "NO_ORDER", "This booking has no Razorpay order.");
  const r = await fetchOrderPayments(b.pay_order_id, b.booking_ref);
  for (const p of r.items) await recordAttempt({ bookingRef: b.booking_ref, userUid: b.user_uid, payment: p, source: "reconcile", verified: true });
  const good = r.items.find((p) => p.status === "captured" || p.status === "authorized");
  let result: unknown = null;
  if (good && b.payment_status !== "paid") result = await confirmPayment(b.pay_order_id, good, "webhook");
  // every refund Razorpay has on the payment (incl. Dashboard refunds) → our records + booking state
  const refunds = (await queryOne<{ p: string | null }>("SELECT pay_payment_id p FROM bookings WHERE booking_ref = ?", [ref]))?.p ? await syncRefundsForBooking(ref) : 0;
  await audit({ actorType: "admin", actorId: a.id, action: "booking.reconciled", targetType: "booking", targetId: ref, meta: { payments: r.count, confirmed: !!result } });
  return ok({ refunds, payments: r.items.map((p) => ({ id: p.id, status: p.status, method: p.method, amount: p.amount })), confirmedNow: !!result, result });
});
