import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ApiError, ok, route } from "../http";
import { rateLimit } from "../ratelimit";
import { getClientIp } from "../request";
import { getSessionUser } from "../session";
import { parseQuery } from "./validators";
import { getSetting } from "../settings";
import type { RailResult } from "./client";

/**
 * Wraps a /api/train/* handler:
 *  - per-user (or per-IP) rate limit sized to the endpoint's credit cost
 *  - optional login requirement for the expensive live endpoints
 *  - query validation (bad input never reaches RailCore)
 *  - uniform response: { ok, data, meta: { retrieved_at, source } } — credits are never exposed publicly
 */
export function trainRoute<S extends z.ZodRawShape, C = unknown>(
  opts: { name: string; shape: S; limit: number; windowSec?: number; auth?: boolean; live?: boolean },
  fn: (q: z.infer<z.ZodObject<S>>, ctx: { userId: number | null; params: Record<string, string> }) => Promise<RailResult<unknown>>,
) {
  return route<C>(async (req: NextRequest, ctx) => {
    if ((await getSetting("service_train")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Train service is not available.");
    if (opts.live && (await getSetting("train_live")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Live running status is not available.");
    const user = await getSessionUser();
    if (opts.auth && !user) throw new ApiError(401, "LOGIN_REQUIRED", "Please log in to see live train data.");
    const who = user ? `u:${user.id}` : `ip:${getClientIp(req.headers)}`;
    const rl = await rateLimit(`train:${opts.name}:${who}`, opts.limit, opts.windowSec ?? 600);
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many train lookups. Please wait a few minutes.", { retryAfter: rl.retryAfter });

    const params = ((ctx as { params?: Promise<Record<string, string>> })?.params ? await (ctx as { params: Promise<Record<string, string>> }).params : {}) as Record<string, string>;
    const sp = new URLSearchParams(req.nextUrl.searchParams);
    for (const [k, v] of Object.entries(params)) sp.set(k, v);
    const parsed = parseQuery(sp, opts.shape);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ApiError(422, "VALIDATION", i?.message || "Invalid input", { field: i?.path.join(".") });
    }
    const r = await fn(parsed.data as z.infer<z.ZodObject<S>>, { userId: user?.id ?? null, params });
    return ok({ data: r.data, meta: { retrieved_at: r.meta.freshness?.retrieved_at || r.meta.timestamp, source: "RailCore" } });
  });
}
