import type { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/server/http";
import { getSessionAdmin, getSessionUser } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { can, SERVICES } from "@/lib/permissions";
import { getPublicSettings } from "@/lib/server/settings";
import { invoicePdf } from "@/lib/server/booking/ticket-pdf";
import type { TrainBookingDetails } from "@/lib/server/booking/train-booking";
import type { FlightBookingDetails } from "@/lib/server/booking/flight-booking";

type Ctx = { params: Promise<{ ref: string }> };

/** Invoice / payment receipt PDF for a paid booking — owner, or an agent with train-bookings access. */
export const GET = route<Ctx>(async (req: NextRequest, { params }) => {
  const ref = (await params).ref;
  if (!/^SKT\d{8}$/.test(ref)) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
  const b = await queryOne<{ user_uid: string; service: string; payment_status: string; amount_paise: number; pay_payment_id: string | null; pay_order_id: string | null; paid_at: Date | null; created_at: Date; details_enc: string; method: string | null }>(
    `SELECT b.user_uid, b.service, b.payment_status, b.amount_paise, b.pay_payment_id, b.pay_order_id, b.paid_at, b.created_at, b.details_enc,
            (SELECT a.method FROM payment_attempts a WHERE a.payment_id = b.pay_payment_id LIMIT 1) AS method
       FROM bookings b WHERE b.booking_ref = ?`,
    [ref],
  );
  const user = await getSessionUser();
  const admin = await getSessionAdmin();
  if (!b || !((user && user.uid === b.user_uid) || (admin && can(admin, SERVICES.find((s) => s.key === b.service)?.perm ?? "bookings.train")))) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
  if (b.payment_status !== "paid" && b.payment_status !== "refunded") throw new ApiError(409, "NOT_PAID", "An invoice is available once the booking is paid.");
  const site = await getPublicSettings();
  const refunds = await query<{ refund_id: string | null; amount_paise: number; status: string; created_at: Date }>("SELECT refund_id, amount_paise, status, created_at FROM refunds WHERE booking_ref = ? ORDER BY id", [ref]);
  const pdf = await invoicePdf({
    ref, uid: b.user_uid, details: JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails | FlightBookingDetails, amountPaise: b.amount_paise, paymentId: b.pay_payment_id, orderId: b.pay_order_id,
    method: b.method, paidAt: b.paid_at, createdAt: b.created_at, site: site.site_name, supportEmail: site.support_email,
    refunds: refunds.map((r) => ({ refundId: r.refund_id, amountPaise: r.amount_paise, status: r.status, at: r.created_at })),
  });
  const inline = req.nextUrl.searchParams.get("view") === "1";
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${site.site_name}-Invoice-${ref}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});
