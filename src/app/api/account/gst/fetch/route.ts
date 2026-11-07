import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { digioFetchGst, getUserGst, gstMode, saveUserGst } from "@/lib/server/gst";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** POST { gstin } — look the GSTIN up with Digio (paid call, rate-limited) and save it to the profile. */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  if ((await gstMode()) === "manual") throw new ApiError(403, "GST_MANUAL_ONLY", "Please enter your GST details manually.");
  const rl = await rateLimit(`gst:fetch:${u.id}`, 5, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many GST lookups. Try again later or enter the details manually.", { retryAfter: rl.retryAfter });
  const { gstin } = await readJson(req, z.object({ gstin: z.string().trim().min(15).max(15) }));
  const g = await digioFetchGst(gstin, u.uid);
  await saveUserGst(u.id, g, "fetch", g);
  await audit({ actorType: "user", actorId: u.id, action: "gst.saved", targetType: "user", targetId: u.uid, ip: getClientIp(req.headers), meta: { source: "fetch", status: g.status } });
  return ok({ gst: await getUserGst(u.id), tradeName: g.tradeName });
});
