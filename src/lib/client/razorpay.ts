"use client";

import { api } from "./api";

/** Loads Razorpay Standard Checkout (https://checkout.razorpay.com/v1/checkout.js) once. */
type RzpHandlerResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpFailed = { error: { code: string; description: string; source?: string; step?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } } };
type RzpInstance = { open: () => void; on: (ev: "payment.failed", cb: (r: RzpFailed) => void) => void; close?: () => void };
type RzpCtor = new (opts: Record<string, unknown>) => RzpInstance;

let loading: Promise<RzpCtor> | null = null;

export function loadRazorpay(): Promise<RzpCtor> {
  const w = window as unknown as { Razorpay?: RzpCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export async function openCheckout(
  options: Record<string, unknown>,
  cb: { onSuccess: (r: RzpHandlerResponse) => void; onFailed: (r: RzpFailed) => void; onDismiss: () => void; failurePath?: string | null },
) {
  const Razorpay = await loadRazorpay();
  const rzp = new Razorpay({ ...options, handler: cb.onSuccess, modal: { ondismiss: cb.onDismiss, confirm_close: true }, retry: { enabled: true } });
  rzp.on("payment.failed", (r) => {
    // Log the failed attempt for admins (log-only; status comes from the webhook).
    const ref = (options.notes as { booking_ref?: string } | undefined)?.booking_ref;
    if (ref && cb.failurePath !== null) void api(cb.failurePath || "/api/bookings/train/failed", { body: { bookingRef: ref, error: r.error } }).catch(() => {});
    cb.onFailed(r);
  });
  rzp.open();
}
