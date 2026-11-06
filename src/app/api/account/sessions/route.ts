import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser, revokeAllUserSessions, revokeUserSession } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";

/** The signed-in customer's own active devices. */
export const GET = route(async () => {
  const u = await requireUser();
  const rows = await query<{ id: number; device: string; location: string | null; ip: string; client: string; created_at: Date; last_seen_at: Date }>(
    "SELECT id, device, location, ip, client, created_at, last_seen_at FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() ORDER BY last_seen_at DESC LIMIT 50",
    [u.id],
  );
  return ok({ sessions: rows.map((r) => ({ ...r, current: r.id === u.sessionId })) });
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
