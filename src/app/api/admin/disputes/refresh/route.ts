import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/ratelimit";
import { syncRefundsForBooking } from "@/lib/server/payments/refunds";
import { can, SERVICES } from "@/lib/permissions";

/**
 * POST — re-check every open case with Razorpay at once:
 *   refunds still pending, paid bookings without a ticket and not fully refunded, and paid bookings
 *   from the last 7 days (catches refunds made from the Razorpay Dashboard).
 * Runs 4 at a time; one Razorpay call per booking.
 */
export const POST = route(async () => {
  const a = await requireAdmin();
  const services = SERVICES.filter((s) => can(a, s.perm)).map((s) => s.key);
  if (!services.length) throw new ApiError(403, "FORBIDDEN", "You don't have access to bookings.");
  const rl = await rateLimit(`disputes:refresh:${a.id}`, 30, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Refreshing too often — wait a minute.", { retryAfter: rl.retryAfter });
  const refs = (
    await query<{ booking_ref: string }>(
      `SELECT DISTINCT b.booking_ref FROM bookings b
        WHERE b.service IN (${services.map(() => "?").join(",")}) AND b.pay_payment_id IS NOT NULL AND b.payment_status IN ('paid','refunded') AND (
              EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'pending')
           OR (b.ticket_status <> 'issued' AND b.payment_status = 'paid')
           OR (b.payment_status = 'paid' AND b.paid_at > UTC_TIMESTAMP() - INTERVAL 7 DAY))
        ORDER BY b.id DESC LIMIT 60`,
      services,
    )
  ).map((r) => r.booking_ref);
  const results: { ref: string; ok: boolean; refunds?: number; error?: string }[] = [];
  for (let i = 0; i < refs.length; i += 4) {
    const batch = refs.slice(i, i + 4);
    const out = await Promise.all(
      batch.map((ref) => syncRefundsForBooking(ref).then((n) => ({ ref, ok: true, refunds: n })).catch((e) => ({ ref, ok: false, error: (e as Error).message }))),
    );
    results.push(...out);
  }
  return ok({ checked: results.length, failed: results.filter((r) => !r.ok).length, results, at: new Date().toISOString() });
});
