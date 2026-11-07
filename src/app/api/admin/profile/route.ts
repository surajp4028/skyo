import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** GET — the signed-in agent's own profile. */
export const GET = route(async () => {
  const a = await requireAdmin();
  const r = await queryOne<{ last_login_at: Date | null; last_login_ip_enc: string | null; password_changed_at: Date | null; created_at: Date }>(
    "SELECT last_login_at, last_login_ip_enc, password_changed_at, created_at FROM admins WHERE id = ?",
    [a.id],
  );
  return ok({
    profile: {
      id: a.id, name: a.name, email: a.email, role: a.role, permissions: a.permissions, avatar: a.avatar ?? null,
      lastLoginAt: r?.last_login_at ?? null, lastLoginIp: (await decrypt(r?.last_login_ip_enc ?? null)) || null, passwordChangedAt: r?.password_changed_at ?? null, createdAt: r?.created_at ?? null,
    },
  });
});

/** PATCH { name } — agents can change their display name (email stays with the admin who manages staff). */
export const PATCH = route(async (req: NextRequest) => {
  const a = await requireAdmin();
  const body = await readJson(req, z.object({ name: z.string().trim().min(2).max(60).regex(/^[\p{L} .'-]+$/u, "Letters, spaces, . ' - only") }));
  await exec("UPDATE admins SET name_enc = ? WHERE id = ?", [await encrypt(body.name), a.id]);
  await audit({ actorType: "admin", actorId: a.id, action: "admin.profile_updated", targetType: "admin", targetId: String(a.id), ip: getClientIp(req.headers) });
  return ok({ name: body.name });
});
