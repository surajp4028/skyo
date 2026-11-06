import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { clearAdminCookie, getSessionAdmin, revokeAdminSession } from "@/lib/server/session";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

export const POST = route(async (req: NextRequest) => {
  const a = await getSessionAdmin();
  if (a) {
    await revokeAdminSession(a.sessionId, "logout");
    await audit({ actorType: "admin", actorId: a.id, action: "agent.logout", ip: getClientIp(req.headers) });
  }
  await clearAdminCookie();
  return ok({});
});
