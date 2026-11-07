import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/crypto";
import { strongPassword } from "@/lib/server/validators";
import { rateLimit } from "@/lib/server/ratelimit";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** POST { current, next } — change own password; signs out the agent's other sessions. */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin();
  const rl = await rateLimit(`admin:pw:${a.id}`, 5, 900);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.", { retryAfter: rl.retryAfter });
  const body = await readJson(req, z.object({ current: z.string().min(1).max(128), next: strongPassword }));
  const r = await queryOne<{ password_hash: string }>("SELECT password_hash FROM admins WHERE id = ?", [a.id]);
  if (!r || !(await verifyPassword(body.current, r.password_hash))) throw new ApiError(400, "WRONG_PASSWORD", "Current password is incorrect.", { field: "current" });
  if (body.current === body.next) throw new ApiError(422, "VALIDATION", "Choose a different password.", { field: "next" });
  await exec("UPDATE admins SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?", [await hashPassword(body.next), a.id]);
  await exec("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = 'password_changed' WHERE admin_id = ? AND id <> ? AND revoked_at IS NULL", [a.id, a.sessionId]);
  await audit({ actorType: "admin", actorId: a.id, action: "admin.password_changed", targetType: "admin", targetId: String(a.id), ip: getClientIp(req.headers) });
  return ok({});
});
