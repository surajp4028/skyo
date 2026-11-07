import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { createRefund } from "@/lib/server/payments/refunds";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ service: string; ref: string }> };

/** POST { amount? (₹), reason } — full refund by default, or a partial amount. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const { ref } = await params;
  const a = await requireAdmin("payments.refund");
  if (!/^SKT\d{8}$/.test(ref)) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  const body = await readJson(req, z.object({ amount: z.number().positive().max(10_000_000).optional(), reason: z.string().trim().min(3, "Add a short reason").max(200) }));
  const r = await createRefund(ref, { amountPaise: body.amount ? Math.round(body.amount * 100) : undefined, reason: body.reason, by: `admin:${a.id}` });
  await audit({ actorType: "admin", actorId: a.id, action: "booking.refunded", targetType: "booking", targetId: ref, ip: getClientIp(req.headers), meta: { amount: r.amount, refund: r.id, status: r.status } });
  return ok({ refund: { id: r.id, amount: r.amount, status: r.status } });
});
