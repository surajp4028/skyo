import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { bookingForUser, confirmFromCheckout } from "@/lib/server/booking/train-booking";
import { verifyCheckoutSignature } from "@/lib/server/payments/razorpay";
import { logProvider } from "@/lib/server/payments/log";

/** Razorpay Checkout success handler → verify signature against OUR order id → confirm from Razorpay's record. */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(
    req,
    z.object({
      bookingRef: z.string().regex(/^SKT\d{8}$/),
      razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
      razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
      razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  );
  const b = await bookingForUser(body.bookingRef, u.uid);
  const valid = !!b.pay_order_id && body.razorpay_order_id === b.pay_order_id && verifyCheckoutSignature(b.pay_order_id, body.razorpay_payment_id, body.razorpay_signature);
  await logProvider({ bookingRef: b.booking_ref, provider: "razorpay", direction: "inbound", action: "checkout.callback", outcome: valid ? "ok" : "error", externalId: body.razorpay_payment_id, request: body, response: { signature_valid: valid } });
  if (!valid) throw new ApiError(400, "BAD_SIGNATURE", "Payment could not be verified. If money was debited it will be refunded automatically.");
  const r = await confirmFromCheckout(b.pay_order_id!, body.razorpay_payment_id, b.booking_ref);
  return ok({ result: r });
});
