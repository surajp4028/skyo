import "server-only";
import crypto from "node:crypto";
import { ApiError } from "../http";
import { logProvider } from "./log";

/**
 * Razorpay (https://razorpay.com/docs) — Standard Checkout.
 *  Orders:   POST https://api.razorpay.com/v1/orders   (Basic key_id:key_secret, amount in paise)
 *  Verify:   hex HMAC_SHA256(order_id + "|" + razorpay_payment_id, key_secret)
 *  Webhook:  X-Razorpay-Signature = hex HMAC_SHA256(raw body, webhook_secret)
 *  Fetch:    GET  /v1/payments/{id}      Capture: POST /v1/payments/{id}/capture {amount, currency}
 */
const API = "https://api.razorpay.com/v1";
const cfg = () => ({
  keyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
  keySecret: (process.env.RAZORPAY_KEY_SECRET || "").trim(),
  webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim(),
});
export const razorpayKeyId = () => cfg().keyId;
export const razorpayMode = () => (cfg().keyId.startsWith("rzp_live_") ? "live" : "test");

export type RzpOrder = { id: string; entity: "order"; amount: number; amount_paid: number; amount_due: number; currency: string; receipt: string; status: "created" | "attempted" | "paid"; attempts: number; notes: Record<string, string>; created_at: number };
export type RzpPayment = {
  id: string; entity: "payment"; amount: number; currency: string; status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string; method?: string; captured?: boolean; notes?: Record<string, string>; email?: string; contact?: string; error_code?: string | null; error_description?: string | null; created_at?: number;
};

async function call<T>(method: "GET" | "POST", path: string, body: unknown, log: { action: string; bookingRef?: string; amountPaise?: number }): Promise<T> {
  const { keyId, keySecret } = cfg();
  if (!keyId || !keySecret) throw new ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Payments are not configured yet.");
  const started = Date.now();
  let status = 0;
  let json: unknown = null;
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    status = res.status;
    json = await res.json().catch(() => null);
    const okRes = res.ok;
    await logProvider({
      bookingRef: log.bookingRef, provider: "razorpay", direction: "outbound", action: log.action, httpStatus: status, outcome: okRes ? "ok" : "error",
      externalId: (json as { id?: string } | null)?.id ?? null, amountPaise: log.amountPaise ?? null, latencyMs: Date.now() - started,
      request: { method, url: `${API}${path}`, body: body ?? null }, response: json,
    });
    if (!okRes) {
      const desc = (json as { error?: { description?: string } } | null)?.error?.description;
      throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", desc ? `Payment provider: ${desc}` : "Payment provider error. Please try again.");
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    await logProvider({ bookingRef: log.bookingRef, provider: "razorpay", direction: "outbound", action: log.action, httpStatus: status || null, outcome: "error", latencyMs: Date.now() - started, request: { method, url: `${API}${path}`, body: body ?? null }, response: { error: (e as Error).name } });
    throw new ApiError(504, "PAYMENT_PROVIDER_TIMEOUT", "Payment provider didn't respond. Please try again.");
  }
}

export function createOrder(p: { amountPaise: number; receipt: string; notes: Record<string, string>; bookingRef: string }) {
  if (!Number.isInteger(p.amountPaise) || p.amountPaise < 100) throw new ApiError(400, "BAD_AMOUNT", "Invalid amount.");
  return call<RzpOrder>(
    "POST",
    "/orders",
    { amount: p.amountPaise, currency: "INR", receipt: p.receipt.slice(0, 40), partial_payment: false, notes: p.notes },
    { action: "order.create", bookingRef: p.bookingRef, amountPaise: p.amountPaise },
  );
}

export const fetchPayment = (id: string, bookingRef?: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(id)}`, undefined, { action: "payment.fetch", bookingRef });

/** All payments made against an order (every checkout attempt). */
export const fetchOrderPayments = (orderId: string, bookingRef?: string) =>
  call<{ entity: "collection"; count: number; items: RzpPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`, undefined, { action: "order.payments", bookingRef });

export type RzpRefund = { id: string; entity: "refund"; amount: number; currency: string; payment_id: string; status: "pending" | "processed" | "failed"; speed_processed?: string; created_at: number; notes?: Record<string, string> };

/** POST /v1/payments/{id}/refund — amount in paise (omit for the full amount). Normal speed (5–7 working days). */
export const refundPayment = (paymentId: string, amountPaise: number, p: { bookingRef: string; reason: string; receipt: string }) =>
  call<RzpRefund>(
    "POST",
    `/payments/${encodeURIComponent(paymentId)}/refund`,
    { amount: amountPaise, speed: "normal", receipt: p.receipt.slice(0, 40), notes: { booking_ref: p.bookingRef, reason: p.reason.slice(0, 250) } },
    { action: "refund.create", bookingRef: p.bookingRef, amountPaise },
  );

export const fetchRefund = (paymentId: string, refundId: string, bookingRef?: string) =>
  call<RzpRefund>("GET", `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`, undefined, { action: "refund.fetch", bookingRef });

export const capturePayment = (id: string, amountPaise: number, bookingRef?: string) =>
  call<RzpPayment>("POST", `/payments/${encodeURIComponent(id)}/capture`, { amount: amountPaise, currency: "INR" }, { action: "payment.capture", bookingRef, amountPaise });

const safeEq = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

/** Checkout success signature — order_id must come from OUR booking record, not the client. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = cfg();
  if (!keySecret) return false;
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEq(expected, signature);
}

/** Webhook signature over the exact raw body bytes. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const { webhookSecret } = cfg();
  if (!webhookSecret || !signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEq(expected, signature);
}
