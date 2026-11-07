import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchPayment, verifyWebhookSignature, type RzpPayment } from "@/lib/server/payments/razorpay";
import { recordAttempt } from "@/lib/server/payments/attempts";
import { queryOne } from "@/lib/server/db";
import { logProvider } from "@/lib/server/payments/log";
import { confirmPayment } from "@/lib/server/booking/train-booking";

/**
 * Razorpay webhook — configure in Dashboard → Webhooks:
 *   URL:    https://<your-domain>/api/payments/razorpay/webhook
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed, order.paid (payment.authorized only if manual capture)
 * Double validation:
 *   1. X-Razorpay-Signature (HMAC-SHA256 of the RAW body with the webhook secret) must match.
 *   2. The payment is then re-fetched from Razorpay's API (GET /v1/payments/{id}) and only THAT record
 *      (status, order, amount) is trusted — the webhook body alone never confirms a booking.
 * De-duplicated by x-razorpay-event-id; answers 2xx fast; 5xx makes Razorpay retry (up to 24 h).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  const eventId = req.headers.get("x-razorpay-event-id");
  const valid = verifyWebhookSignature(raw, sig);
  let payload: { event?: string; payload?: { payment?: { entity?: RzpPayment }; order?: { entity?: { id?: string; receipt?: string } } } } = {};
  try {
    payload = JSON.parse(raw);
  } catch {}
  const pay = payload.payload?.payment?.entity;
  const ref = pay?.notes?.booking_ref ?? payload.payload?.order?.entity?.receipt?.replace(/^SKYO_/, "") ?? null;

  const fresh = await logProvider({
    bookingRef: ref, provider: "razorpay", direction: "inbound", action: `webhook.${payload.event || "unknown"}`, httpStatus: valid ? 200 : 401,
    outcome: valid ? "ok" : "error", externalId: pay?.id ?? null, eventId: valid ? eventId : null, amountPaise: pay?.amount ?? null,
    request: { headers: { "x-razorpay-event-id": eventId, "x-razorpay-signature": sig ? "present" : "missing" }, body: payload }, response: { signature_valid: valid },
  });
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 });
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true }); // already processed

  try {
    const handled = ["payment.captured", "order.paid", "payment.authorized", "payment.failed"];
    if (payload.event && handled.includes(payload.event) && pay?.id && pay.order_id) {
      const booking = await queryOne<{ booking_ref: string; user_uid: string }>("SELECT booking_ref, user_uid FROM bookings WHERE pay_order_id = ?", [pay.order_id]);
      if (booking) {
        const fresh = await fetchPayment(pay.id, booking.booking_ref); // second, independent check
        if (fresh.order_id !== pay.order_id) throw new Error("order mismatch between webhook and API");
        if (fresh.status === "failed") await recordAttempt({ bookingRef: booking.booking_ref, userUid: booking.user_uid, payment: fresh, source: "webhook", verified: true });
        await confirmPayment(pay.order_id, fresh, "webhook");
      }
    }
  } catch (e) {
    console.error("[razorpay-webhook] processing error", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 }); // Razorpay will retry
  }
  return NextResponse.json({ ok: true });
}
