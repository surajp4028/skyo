import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { can, SERVICES } from "@/lib/permissions";
import { maskEmail, maskPhone } from "@/lib/server/validators";
import { listBookingAttempts } from "@/lib/server/payments/attempts";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import type { TrainBookingDetails } from "@/lib/server/booking/train-booking";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/**
 * Everything about one booking for the admin side panel: customer, trip, passengers, charges,
 * insurance, ticket (S3), every Razorpay payment attempt (full payload) and every provider
 * request/response with timestamps.
 */
export const GET = route<Ctx>(async (req, { params }) => {
  const { service, ref } = await params;
  const svc = SERVICES.find((s) => s.key === service);
  if (!svc) throw new ApiError(404, "NOT_FOUND", "Unknown service");
  const a = await requireAdmin(svc.perm);
  const b = await queryOne<{
    id: number; booking_ref: string; user_uid: string; service: string; status: string; payment_status: string; ticket_status: string; amount_paise: number; currency: string;
    pay_provider: string | null; pay_order_id: string | null; pay_payment_id: string | null; paid_at: Date | null; issued_at: Date | null; hold_expires_at: Date | null;
    created_at: Date; updated_at: Date; travel_date: string | null; travellers: number; details_enc: string; pnr_enc: string | null; provider_ref_enc: string | null; ticket_key_enc: string | null;
    user_id: number; user_name_enc: string | null;
  }>(
    `SELECT b.*, u.id AS user_id, u.name_enc AS user_name_enc FROM bookings b LEFT JOIN users u ON u.uid = b.user_uid WHERE b.booking_ref = ? AND b.service = ?`,
    [ref, svc.key],
  );
  if (!b) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const full = can(a, "users.contact");
  const contact = {
    name: d.contact?.name ?? null,
    email: d.contact?.email ? (full ? d.contact.email : maskEmail(d.contact.email)) : null,
    phone: d.contact?.phone ? (full ? d.contact.phone : maskPhone(d.contact.phone.replace(/\D/g, "").slice(-10))) : null,
    masked: !full,
  };
  const seeLogs = can(a, "payments.view");
  const logs = seeLogs
    ? await Promise.all(
        (await query<{ id: number; provider: string; direction: string; action: string; http_status: number | null; outcome: string; external_id: string | null; event_id: string | null; amount_paise: number | null; latency_ms: number | null; request_enc: string | null; response_enc: string | null; created_at: Date }>(
          "SELECT id, provider, direction, action, http_status, outcome, external_id, event_id, amount_paise, latency_ms, request_enc, response_enc, created_at FROM payment_logs WHERE booking_ref = ? ORDER BY id",
          [ref],
        )).map(async ({ request_enc, response_enc, ...r }) => ({ ...r, request: (await decrypt(request_enc)) || null, response: (await decrypt(response_enc)) || null })),
      )
    : null;
  const ticketKey = (await decrypt(b.ticket_key_enc)) || null;
  await audit({ actorType: "admin", actorId: a.id, action: "booking.viewed", targetType: "booking", targetId: ref, ip: getClientIp(req.headers), meta: { contact: full ? "full" : "masked" } });
  return ok({
    booking: {
      ref: b.booking_ref, service: b.service, status: b.status, paymentStatus: b.payment_status, ticketStatus: b.ticket_status,
      amountPaise: b.amount_paise, currency: b.currency, payProvider: b.pay_provider, orderId: b.pay_order_id, paymentId: b.pay_payment_id,
      paidAt: b.paid_at, issuedAt: b.issued_at, holdExpiresAt: b.hold_expires_at, createdAt: b.created_at, updatedAt: b.updated_at,
      travelDate: b.travel_date, travellers: b.travellers, pnr: (await decrypt(b.pnr_enc)) || null, providerRef: (await decrypt(b.provider_ref_enc)) || null,
      ticketKey, ticketStored: !!ticketKey,
    },
    user: { id: b.user_id, uid: b.user_uid, name: (await decrypt(b.user_name_enc)) || null },
    contact,
    details: { ...d, contact: undefined },
    attempts: seeLogs ? await listBookingAttempts(ref) : null,
    logs,
  });
});
