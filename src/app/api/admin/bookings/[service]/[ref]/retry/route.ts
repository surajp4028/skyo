import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { issueForBooking } from "@/lib/server/booking/train-booking";
import { refundedSoFar } from "@/lib/server/payments/refunds";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/** POST — try ticketing again for a paid booking whose ticket failed (only if nothing was refunded yet). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const { service, ref } = await params;
  if (service !== "train" && service !== "flight") throw new ApiError(400, "UNSUPPORTED", "Only train and flight bookings can be retried.");
  const a = await requireAdmin("payments.refund");
  if ((await refundedSoFar(ref)) > 0) throw new ApiError(409, "ALREADY_REFUNDED", "This booking was already refunded — ask the customer to book again.");
  const r = await issueForBooking(ref, { autoRefund: false });
  await audit({ actorType: "admin", actorId: a.id, action: "booking.retry_ticket", targetType: "booking", targetId: ref, ip: getClientIp(req.headers), meta: { ok: r.ok } });
  if (!r.ok) throw new ApiError(502, "TICKET_FAILED", `Ticketing failed again: ${"error" in r ? r.error : "unknown error"}`);
  return ok(r);
});
