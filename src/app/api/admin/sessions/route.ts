import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin, revokeAdminSession, revokeUserSession } from "@/lib/server/session";
import { listSessions } from "@/lib/server/admin/queries";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

export const GET = route(async (req: NextRequest) => {
  const a = await requireAdmin("sessions.view");
  if (req.nextUrl.searchParams.get("kind") === "admin" && !can(a, "staff.manage")) throw new ApiError(403, "FORBIDDEN", "Only admins can view agent sessions.");
  return ok(await listSessions(req.nextUrl.searchParams, can(a, "users.contact")));
});

/** Force-logout a session. */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("sessions.revoke");
  const body = await readJson(req, z.object({ kind: z.enum(["user", "admin"]), id: z.number().int().positive() }));
  if (body.kind === "admin") {
    if (!can(a, "staff.manage")) throw new ApiError(403, "FORBIDDEN", "Only admins can end agent sessions.");
    await revokeAdminSession(body.id, `forced_by_${a.id}`);
  } else await revokeUserSession(body.id, `forced_by_admin_${a.id}`);
  await audit({ actorType: "admin", actorId: a.id, action: "session.revoke", targetType: `${body.kind}_session`, targetId: body.id, ip: getClientIp(req.headers) });
  return ok({});
});
