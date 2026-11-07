import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { runFlightMaintenance } from "@/lib/server/flight/maintenance";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** POST — run flight data retention now (clears old responses, stale caches, dead seat holds). */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("settings.manage");
  const r = await runFlightMaintenance(true);
  await audit({ actorType: "admin", actorId: a.id, action: "flight.maintenance", targetType: "system", targetId: "flights", ip: getClientIp(req.headers), meta: r ?? {} });
  return ok({ result: r });
});
