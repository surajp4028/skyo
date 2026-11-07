import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { refreshRoute } from "@/lib/server/flight/search";
import { airportCode } from "@/lib/server/flight/validators";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { exec } from "@/lib/server/db";

/** POST { from, to, pages?, action? } — refresh a route now (costs 1 request per page) or drop it from the cache. */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("settings.manage");
  const b = await readJson(req, z.object({ from: airportCode, to: airportCode, pages: z.number().int().min(1).max(4).optional(), action: z.enum(["refresh", "drop"]).default("refresh") }));
  if (b.action === "drop") {
    await exec("DELETE FROM flight_routes WHERE dep_iata = ? AND arr_iata = ?", [b.from, b.to]);
    await audit({ actorType: "admin", actorId: a.id, action: "flight.route_dropped", targetType: "route", targetId: `${b.from}-${b.to}`, ip: getClientIp(req.headers) });
    return ok({ dropped: true });
  }
  const r = await refreshRoute(b.from, b.to, { reason: "admin_refresh", adminId: a.id }, b.pages);
  await audit({ actorType: "admin", actorId: a.id, action: "flight.route_refreshed", targetType: "route", targetId: `${b.from}-${b.to}`, ip: getClientIp(req.headers), meta: { flights: r.legs.length } });
  return ok({ flights: r.legs.length, upstreamTotal: r.upstreamTotal, fetchedAt: r.fetchedAt });
});
