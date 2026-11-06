import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser, revokeAllUserSessions, revokeUserSession } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";

/** The signed-in customer's own active devices. */
export const GET = route(async () => {
  const u = await requireUser();
  const rows = await query<{ id: number; device_enc: string | null; location_enc: string | null; ip_enc: string | null; client: string; created_at: Date; last_seen_at: Date }>(
    "SELECT id, device_enc, location_enc, ip_enc, client, created_at, last_seen_at FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() ORDER BY last_seen_at DESC LIMIT 50",
    [u.id],
  );
  const sessions = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      device: (await decrypt(r.device_enc)) || "Unknown device",
      location: (await decrypt(r.location_enc)) || null,
      ip: await decrypt(r.ip_enc),
      client: r.client,
      created_at: r.created_at,
      last_seen_at: r.last_seen_at,
      current: r.id === u.sessionId,
    })),
  );
  return ok({ sessions });
});

/** Revoke one device ({id}) or all other devices ({all:true}). */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(req, z.object({ id: z.number().int().positive().optional(), all: z.boolean().optional() }));
  if (body.all) await revokeAllUserSessions(u.id, "user_logout_others", u.sessionId);
  else if (body.id) {
    const own = await queryOne("SELECT id FROM user_sessions WHERE id = ? AND user_id = ?", [body.id, u.id]);
    if (!own) throw new ApiError(404, "NOT_FOUND", "Session not found");
    await revokeUserSession(body.id, "user_revoked");
  }
  return ok({});
});
