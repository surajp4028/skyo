import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { bookingForUser } from "@/lib/server/booking/train-booking";
import { logProvider } from "@/lib/server/payments/log";
import { recordAttempt } from "@/lib/server/payments/attempts";

/**
 * Razorpay Checkout "payment.failed" callback, reported by the browser.
 * Log-only (marked client_reported) so admins can see failed attempts even when webhooks
 * can't reach the server (localhost). It never changes booking or payment status —
 * the signed webhook / Razorpay's own payment record stay the source of truth.
 */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const rl = await rateLimit(`booking:failed:${u.id}`, 20, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many requests.", { retryAfter: rl.retryAfter });
  const s = z.string().trim().max(300).optional();
  const body = await readJson(
    req,
    z.object({
      bookingRef: z.string().regex(/^SKT\d{8}$/),
      error: z.object({
        code: s,
        description: s,
        source: s,
        step: s,
        reason: s,
        metadata: z.object({ order_id: s, payment_id: s }).partial().optional(),
      }),
    }),
  );
  const b = await bookingForUser(body.bookingRef, u.uid);
  const paymentId = body.error.metadata?.payment_id;
  await logProvider({
    bookingRef: b.booking_ref,
    provider: "razorpay",
    direction: "inbound",
    action: "checkout.failed",
    outcome: "error",
    externalId: paymentId && /^pay_[A-Za-z0-9]+$/.test(paymentId) ? paymentId : b.pay_order_id,
    request: { client_reported: true, ...body.error },
    response: { booking_status: b.status, payment_status: b.payment_status, note: "Logged only — status changes come from the signed webhook / Razorpay payment record." },
  });
  if (paymentId && /^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    await recordAttempt({
      bookingRef: b.booking_ref, userUid: b.user_uid, source: "client", verified: false,
      payment: { id: paymentId, order_id: b.pay_order_id ?? undefined, status: "failed", error_code: body.error.code ?? null, error_description: body.error.description ?? null },
    });
  }
  return ok({});
});
