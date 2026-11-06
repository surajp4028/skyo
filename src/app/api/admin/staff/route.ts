import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, query } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/crypto";
import { emailSchema, nameSchema, strongPassword } from "@/lib/server/validators";
import { isPermission } from "@/lib/permissions";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

export const GET = route(async () => {
  await requireAdmin("staff.manage");
  const rows = await query(
    `SELECT a.id, a.name, a.email, a.role, a.permissions, a.status, a.last_login_at, a.last_login_ip, a.created_at,
            (a.locked_until IS NOT NULL AND a.locked_until > UTC_TIMESTAMP()) AS locked,
            (SELECT COUNT(*) FROM admin_sessions s WHERE s.admin_id = a.id AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) AS active_sessions
       FROM admins a ORDER BY a.role = 'admin' DESC, a.id`,
  );
  return ok({ staff: rows });
});

const staffSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: strongPassword,
  role: z.enum(["admin", "staff"]),
  permissions: z.array(z.string()).max(50).transform((a) => [...new Set(a.filter(isPermission))]),
});

export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("staff.manage");
  const body = await readJson(req, staffSchema);
  try {
    const r = await exec(
      "INSERT INTO admins (name, email, password_hash, role, permissions, created_by, password_changed_at) VALUES (?,?,?,?,?,?, UTC_TIMESTAMP())",
      [body.name, body.email, await hashPassword(body.password), body.role, JSON.stringify(body.role === "admin" ? [] : body.permissions), a.id],
    );
    await audit({ actorType: "admin", actorId: a.id, action: "staff.create", targetType: "admin", targetId: r.insertId, ip: getClientIp(req.headers), meta: { role: body.role } });
    return ok({ id: r.insertId });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "DUPLICATE", "An agent with this email already exists.", { field: "email" });
    throw e;
  }
});
