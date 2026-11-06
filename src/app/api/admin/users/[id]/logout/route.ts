import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ id: string }> };

/** Force-logout one customer from every device. */
export const POST = route<Ctx>(async (req, { params }) => {
  const a = await requireAdmin("sessions.revoke");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "BAD_ID", "Invalid id");
  const r = await exec(
    "UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL",
    [`forced_by_admin_${a.id}`, id],
  );
  await audit({ actorType: "admin", actorId: a.id, action: "user.force_logout", targetType: "user", targetId: id, ip: getClientIp(req.headers), meta: { sessions: r.affectedRows } });
  return ok({ revoked: r.affectedRows });
});
