import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** Emergency switch: log every customer out of every device. Admin role only. */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("staff.manage");
  await readJson(req, z.object({ confirm: z.literal("LOGOUT ALL", { message: 'Type "LOGOUT ALL" to confirm' }) }));
  const r = await exec("UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = ? WHERE revoked_at IS NULL", [`global_logout_by_${a.id}`]);
  await audit({ actorType: "admin", actorId: a.id, action: "user.force_logout_all", ip: getClientIp(req.headers), meta: { sessions: r.affectedRows } });
  return ok({ revoked: r.affectedRows });
});
