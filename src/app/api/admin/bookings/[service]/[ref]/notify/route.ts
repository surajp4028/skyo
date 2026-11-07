import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { resendNotifications } from "@/lib/server/booking/post-issue";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/** POST — send the confirmation SMS + email (with e-ticket) again. Results appear in the booking's log. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const { ref } = await params;
  const a = await requireAdmin("payments.refund");
  const rl = await rateLimit(`notify:${ref}`, 3, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Already resent recently — try again later.", { retryAfter: rl.retryAfter });
  try {
    await resendNotifications(ref);
  } catch (e) {
    throw new ApiError(409, "NOT_ISSUED", (e as Error).message);
  }
  await audit({ actorType: "admin", actorId: a.id, action: "booking.notify_resent", targetType: "booking", targetId: ref, ip: getClientIp(req.headers) });
  return ok({});
});
