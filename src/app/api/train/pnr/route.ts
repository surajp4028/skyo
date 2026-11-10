import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { getSessionUser } from "@/lib/server/session";
import { lookupPnr, saveUserPnr } from "@/lib/server/train/pnr";

/**
 * POST /api/train/pnr  { pnr: "1234567890", refresh?: boolean }
 * POST (not GET) so the PNR never lands in URLs, proxies or access logs.
 * Cached answers are free; fresh lookups are limited per person per day (see lib/server/train/pnr.ts).
 */
const Body = z.object({
  pnr: z
    .string()
    .transform((v) => v.replace(/\D+/g, ""))
    .refine((v) => /^\d{10}$/.test(v), "PNR is 10 digits"),
  refresh: z.boolean().optional(),
});

export const POST = route(async (req: NextRequest) => {
  const user = await getSessionUser();
  const ip = getClientIp(req.headers);
  // burst guard on the endpoint itself (cache hits included) — stops PNR guessing/scraping
  const rl = await rateLimit(`pnr:${user ? `u:${user.id}` : `ip:${ip}`}`, user ? 30 : 12, 600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many PNR checks. Please wait a few minutes.", { retryAfter: rl.retryAfter });
  const { pnr, refresh } = await readJson(req, Body);
  const r = await lookupPnr(pnr, { refresh, userId: user?.id ?? null, ip });
  // logged in → it shows up under "Your PNRs" on every device
  if (user) await saveUserPnr(user.id, pnr, r).catch((e) => console.error("[pnr] save failed", (e as Error).message));
  return ok({ ...r, loggedIn: !!user });
});
