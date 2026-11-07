import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { listUserAttempts } from "@/lib/server/payments/attempts";
import { query } from "@/lib/server/db";

/** GET — every payment attempt the customer made (success / failed / pending), newest first. */
export const GET = route(async () => {
  const u = await requireUser();
  const refunds = await query<{ booking_ref: string; refund_id: string | null; amount_paise: number; status: string; created_at: Date; updated_at: Date }>(
    `SELECT r.booking_ref, r.refund_id, r.amount_paise, r.status, r.created_at, r.updated_at FROM refunds r JOIN bookings b ON b.booking_ref = r.booking_ref
      WHERE b.user_uid = ? AND r.status <> 'failed' ORDER BY r.id DESC LIMIT 50`,
    [u.uid],
  );
  return ok({ attempts: await listUserAttempts(u.uid), refunds: refunds.map((r) => ({ bookingRef: r.booking_ref, refundId: r.refund_id, amount: r.amount_paise / 100, status: r.status, at: r.created_at, updatedAt: r.updated_at })) });
});
