import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { refundState } from "@/lib/server/payments/refunds";
import type { TrainBookingDetails } from "@/lib/server/booking/train-booking";
import { can, SERVICES } from "@/lib/permissions";
import { ApiError } from "@/lib/server/http";

/**
 * Money received but no valid ticket, or any refund: ticket failed, payment after the hold expired,
 * amount mismatch, or refunds made by an agent / from the Razorpay Dashboard.
 *   ?filter=action   paid, no ticket, nothing refunded yet  (needs an agent)
 *           pending  refund started, not yet credited
 *           refunded fully refunded
 *           all
 */
export const GET = route(async (req: NextRequest) => {
  const a = await requireAdmin();
  const services = SERVICES.filter((s) => can(a, s.perm)).map((s) => s.key);
  if (!services.length) throw new ApiError(403, "FORBIDDEN", "You don't have access to bookings.");
  const filter = req.nextUrl.searchParams.get("filter") || "action";
  const rows = await query<{
    booking_ref: string; service: string; user_uid: string; user_id: number | null; name_enc: string | null; status: string; payment_status: string; ticket_status: string; amount_paise: number;
    pay_payment_id: string | null; paid_at: Date | null; hold_expires_at: Date | null; created_at: Date; details_enc: string; processed: number | null; pending: number | null; last_refund_at: Date | null;
  }>(
    `SELECT b.booking_ref, b.service, b.user_uid, u.id AS user_id, u.name_enc, b.status, b.payment_status, b.ticket_status, b.amount_paise, b.pay_payment_id, b.paid_at, b.hold_expires_at, b.created_at, b.details_enc,
            (SELECT SUM(r.amount_paise) FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'processed') AS processed,
            (SELECT SUM(r.amount_paise) FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'pending') AS pending,
            (SELECT MAX(r.created_at) FROM refunds r WHERE r.booking_ref = b.booking_ref) AS last_refund_at
       FROM bookings b LEFT JOIN users u ON u.uid = b.user_uid
      WHERE b.service IN (${services.map(() => "?").join(",")}) AND b.payment_status IN ('paid','refunded')
        AND (b.ticket_status <> 'issued' OR EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status <> 'failed'))
      ORDER BY COALESCE(b.paid_at, b.created_at) DESC LIMIT 300`,
    services,
  );
  const items = await Promise.all(
    rows.map(async (r) => {
      const d = JSON.parse(await decrypt(r.details_enc)) as TrainBookingDetails;
      const state = refundState(r.amount_paise, Number(r.processed || 0), Number(r.pending || 0));
      const late = r.paid_at && r.hold_expires_at && new Date(r.paid_at).getTime() - new Date(r.hold_expires_at).getTime() > 10 * 60_000;
      return {
        ref: r.booking_ref, service: r.service, userUid: r.user_uid, userId: r.user_id, name: (await decrypt(r.name_enc)) || null,
        train: r.service === "flight" ? `${d.train.number} · ${d.train.name}` : `${d.train.number} ${d.train.name}`, route: `${d.from} → ${d.to}`, date: d.date,
        amountPaise: r.amount_paise, paidAt: r.paid_at, paymentId: r.pay_payment_id, ticketStatus: r.ticket_status, status: r.status,
        reason: r.ticket_status === "issued" ? "Refunded after ticketing" : late ? "Paid after the hold expired" : d.failure || "Ticket not issued",
        refundState: state, refundedPaise: Number(r.processed || 0), pendingPaise: Number(r.pending || 0), lastRefundAt: r.last_refund_at,
      };
    }),
  );
  const needsAction = items.filter((i) => i.ticketStatus !== "issued" && i.refundState === "none");
  const list = filter === "pending" ? items.filter((i) => i.refundState === "pending") : filter === "refunded" ? items.filter((i) => i.refundState === "refunded" || i.refundState === "partial") : filter === "all" ? items : needsAction;
  return ok({
    items: list,
    summary: {
      needsAction: needsAction.length,
      needsActionPaise: needsAction.reduce((a, i) => a + i.amountPaise, 0),
      pendingPaise: items.reduce((a, i) => a + i.pendingPaise, 0),
      refundedPaise: items.reduce((a, i) => a + i.refundedPaise, 0),
    },
  });
});
