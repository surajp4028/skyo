import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { exec, queryOne } from "@/lib/server/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/server/crypto";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientInfo, lookupLocation } from "@/lib/server/request";
import { createAdminSession } from "@/lib/server/session";
import { audit } from "@/lib/server/audit";
import { emailSchema } from "@/lib/server/validators";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

/** Agent login (admin + staff). Lockout after 5 failures; generic errors; timing-safe. */
export const POST = route(async (req: NextRequest) => {
  const info = getClientInfo(req.headers);
  const rl = await rateLimit(`admin-login:ip:${info.ip}`, 15, 900);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many login attempts. Try again later.", { retryAfter: rl.retryAfter });

  const body = await readJson(req, z.object({ email: emailSchema, password: z.string().min(1).max(128) }));
  const a = await queryOne<{ id: number; password_hash: string; status: string; role: string; locked: number; failed_attempts: number }>(
    "SELECT id, password_hash, status, role, (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS locked, failed_attempts FROM admins WHERE email = ?",
    [body.email],
  );
  const valid = await verifyPassword(body.password, a?.password_hash || DUMMY_PASSWORD_HASH);
  const generic = new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

  if (!a) {
    await audit({ actorType: "system", action: "agent.login_failed", ip: info.ip, userAgent: info.userAgent, meta: { reason: "unknown_email" } });
    throw generic;
  }
  if (a.locked) throw new ApiError(423, "LOCKED", `Account temporarily locked after repeated failures. Try again in ${LOCK_MINUTES} minutes.`);
  if (!valid) {
    const fails = a.failed_attempts + 1;
    await exec(
      "UPDATE admins SET failed_attempts = ?, locked_until = IF(? >= ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, locked_until) WHERE id = ?",
      [fails >= MAX_FAILS ? 0 : fails, fails, MAX_FAILS, LOCK_MINUTES, a.id],
    );
    await audit({ actorType: "admin", actorId: a.id, action: fails >= MAX_FAILS ? "agent.locked" : "agent.login_failed", ip: info.ip, userAgent: info.userAgent });
    throw generic;
  }
  if (a.status !== "active") throw new ApiError(403, "INACTIVE", "This agent account is disabled. Contact your administrator.");

  await exec("UPDATE admins SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(), last_login_ip = ? WHERE id = ?", [info.ip, a.id]);
  const location = await lookupLocation(info.ip, req.headers);
  await createAdminSession(a.id, { ...info, location });
  await audit({ actorType: "admin", actorId: a.id, action: "agent.login", ip: info.ip, userAgent: info.userAgent, meta: { role: a.role } });
  return ok({ redirect: "/admin" });
});
