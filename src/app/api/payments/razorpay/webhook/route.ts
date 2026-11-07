import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyWebhookSignature, type RzpPayment } from "@/lib/server/payments/razorpay";
import { logProvider } from "@/lib/server/payments/log";
import { confirmPayment } from "@/lib/server/booking/train-booking";

/**
 * Razorpay webhook — configure in Dashboard → Webhooks:
 *   URL:    https://<your-domain>/api/payments/razorpay/webhook
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed, order.paid (payment.authorized only if manual capture)
 * Verifies X-Razorpay-Signature over the RAW body, de-duplicates by x-razorpay-event-id, answers 2xx fast.
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
    if ((payload.event === "payment.captured" || payload.event === "order.paid" || payload.event === "payment.authorized" || payload.event === "payment.failed") && pay?.order_id) {
      await confirmPayment(pay.order_id, pay, "webhook");
    }
  } catch (e) {
    console.error("[razorpay-webhook] processing error", (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 }); // Razorpay will retry
  }
  return NextResponse.json({ ok: true });
}
