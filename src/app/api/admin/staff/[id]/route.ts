import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/crypto";
import { nameSchema, strongPassword } from "@/lib/server/validators";
import { isPermission } from "@/lib/permissions";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({
  name: nameSchema.optional(),
  role: z.enum(["admin", "staff"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  password: strongPassword.optional(),
  permissions: z.array(z.string()).max(50).transform((a) => [...new Set(a.filter(isPermission))]).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const a = await requireAdmin("staff.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "BAD_ID", "Invalid id");
  const body = await readJson(req, patch);
  const target = await queryOne<{ id: number; role: string }>("SELECT id, role FROM admins WHERE id = ?", [id]);
  if (!target) throw new ApiError(404, "NOT_FOUND", "Agent not found");

  if (id === a.id && (body.status === "inactive" || body.role === "staff")) {
    throw new ApiError(400, "SELF_LOCKOUT", "You can't disable or demote your own account.");
  }
  if (target.role === "admin" && (body.role === "staff" || body.status === "inactive")) {
    const admins = await queryOne<{ n: number }>("SELECT COUNT(*) n FROM admins WHERE role='admin' AND status='active'");
    if ((admins?.n ?? 0) <= 1) throw new ApiError(400, "LAST_ADMIN", "At least one active admin is required.");
  }

  const sets: string[] = [];
  const vals: (string | number)[] = [];
  const add = (sql: string, val: string | number) => {
    sets.push(sql);
    vals.push(val);
  };
  if (body.name) add("name = ?", body.name);
  if (body.role) add("role = ?", body.role);
  if (body.status) add("status = ?", body.status);
  if (body.permissions) add("permissions = ?", JSON.stringify(body.permissions));
  if (body.password) add("password_hash = ?, password_changed_at = UTC_TIMESTAMP(), failed_attempts = 0, locked_until = NULL", await hashPassword(body.password));
  if (!sets.length) return ok({});
  await exec(`UPDATE admins SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);

  // Any security-relevant change ends the agent's existing sessions
  if (body.status === "inactive" || body.password || body.role || body.permissions) {
    if (id !== a.id) await exec("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = 'account_changed' WHERE admin_id = ? AND revoked_at IS NULL", [id]);
  }
  await audit({ actorType: "admin", actorId: a.id, action: "staff.update", targetType: "admin", targetId: id, ip: getClientIp(req.headers), meta: { fields: Object.keys(body).filter((k) => k !== "password").concat(body.password ? ["password"] : []) } });
  return ok({});
});
