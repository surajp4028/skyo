import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { publicCoupon, validateCoupon } from "@/lib/server/coupons";

/** POST { code, service } — validate a typed coupon for the signed-in customer. Rate-limited against code guessing. */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const rl = await rateLimit(`coupon:check:${u.id}`, 20, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many coupon attempts. Please wait a few minutes.", { retryAfter: rl.retryAfter });
  const body = await readJson(req, z.object({ code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/, "Invalid code"), service: z.enum(["train", "flight", "bus", "hotel", "package"]).default("train") }));
  const r = await validateCoupon(body.code, u.uid, body.service);
  return ok({ coupon: { ...publicCoupon(r.coupon), usesLeftForYou: r.usesLeftForYou } });
});
