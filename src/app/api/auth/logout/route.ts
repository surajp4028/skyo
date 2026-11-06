import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { clearUserCookie, getSessionUser, revokeUserSession } from "@/lib/server/session";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

export const POST = route(async (req: NextRequest) => {
  const s = await getSessionUser();
  if (s) {
    await revokeUserSession(s.sessionId, "logout");
    await audit({ actorType: "user", actorId: s.id, action: "user.logout", ip: getClientIp(req.headers) });
  }
  await clearUserCookie();
  return ok({});
});
