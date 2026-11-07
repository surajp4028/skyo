import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { availableCoupons } from "@/lib/server/coupons";
import { SERVICE_KEYS } from "@/lib/services";

/** GET /api/coupons?service=train — offers the signed-in customer can use now (incl. personal codes). */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const s = req.nextUrl.searchParams.get("service") || "train";
  const service = (SERVICE_KEYS as readonly string[]).includes(s) ? s : "train";
  return ok({ coupons: await availableCoupons(u.uid, service) });
});
