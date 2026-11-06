import "server-only";
import { cookies, headers } from "next/headers";
import { exec, queryOne, sqlDate } from "./db";
import { env, isProd } from "./env";
import { bidxOpt, decrypt, encOpt, randomToken, sha256 } from "./crypto";
import { ApiError } from "./http";
import type { ClientInfo } from "./request";
import { ADMIN_ONLY, can, isPermission, type AdminIdentity, type Permission } from "../permissions";

/* =====================================================================
 * Sessions
 *  - Opaque 256-bit random tokens; DB stores only SHA-256(token).
 *  - Customer:  long-lived (USER_SESSION_DAYS, rolling) → "stay logged in until logout".
 *  - Agent:     browser-session cookie, 30-min idle + 12h absolute timeout.
 *  - Cookies:   HttpOnly, SameSite=Lax, Secure + __Host- prefix in production.
 *  - Mobile apps (future) send `Authorization: Bearer <token>` instead of cookies.
 * ===================================================================== */

export const USER_COOKIE = isProd ? "__Host-skyo_s" : "skyo_s";
export const ADMIN_COOKIE = isProd ? "__Host-skyo_a" : "skyo_a";

const baseCookie = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

async function bearer(): Promise<string | null> {
  const h = (await headers()).get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

/* ----------------------------- Customers ----------------------------- */

export type SessionUser = { id: number; uid: string; sessionId: number };

async function encClient(info: ClientInfo & { location: string }) {
  const [ip, location, ua, device] = await Promise.all([encOpt(info.ip), encOpt(info.location), encOpt(info.userAgent), encOpt(info.device)]);
  return { ip, ipBidx: bidxOpt("ip", info.ip), location, ua, device };
}

export async function createUserSession(userId: number, info: ClientInfo & { location: string }, method: string) {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + env.userSessionDays * 86400_000);
  const e = await encClient(info);
  await exec(
    "INSERT INTO user_sessions (user_id, token_hash, ip_enc, ip_bidx, location_enc, user_agent_enc, device_enc, client, login_method, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [userId, sha256(token), e.ip, e.ipBidx, e.location, e.ua, e.device, info.client, method, sqlDate(now), sqlDate(now), sqlDate(expires)],
  );
  await exec("UPDATE users SET last_login_at = ?, last_login_ip_enc = ?, last_login_ip_bidx = ?, last_location_enc = ?, last_device_enc = ? WHERE id = ?", [
    sqlDate(now),
    e.ip,
    e.ipBidx,
    e.location,
    e.device,
    userId,
  ]);
  if (info.client === "web") {
    (await cookies()).set(USER_COOKIE, token, { ...baseCookie, expires });
  }
  return { token, expiresAt: expires.toISOString() };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await bearer()) || (await cookies()).get(USER_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await queryOne<{ sid: number; stale: number; id: number; uid: string }>(
    `SELECT s.id AS sid, (s.last_seen_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE) AS stale, u.id, u.uid
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP() AND u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;
  if (row.stale) {
    // rolling expiry: active users stay signed in
    await exec("UPDATE user_sessions SET last_seen_at = UTC_TIMESTAMP(), expires_at = UTC_TIMESTAMP() + INTERVAL ? DAY WHERE id = ?", [
      env.userSessionDays,
      row.sid,
    ]);
  }
  return { id: row.id, uid: row.uid, sessionId: row.sid };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return u;
}

export async function revokeUserSession(sessionId: number, reason: string) {
  await exec("UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = ? WHERE id = ? AND revoked_at IS NULL", [reason, sessionId]);
}

export async function revokeAllUserSessions(userId: number, reason: string, exceptSessionId?: number) {
  await exec(
    "UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL AND id <> ?",
    [reason, userId, exceptSessionId ?? 0],
  );
}

export async function clearUserCookie() {
  (await cookies()).set(USER_COOKIE, "", { ...baseCookie, maxAge: 0 });
}

/* ------------------------------- Agents ------------------------------ */

export type SessionAdmin = AdminIdentity & { sessionId: number };

export async function createAdminSession(adminId: number, info: ClientInfo & { location: string }) {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + env.adminSessionHours * 3600_000);
  const e = await encClient(info);
  await exec(
    "INSERT INTO admin_sessions (admin_id, token_hash, ip_enc, ip_bidx, location_enc, user_agent_enc, device_enc, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [adminId, sha256(token), e.ip, e.ipBidx, e.location, e.ua, e.device, sqlDate(now), sqlDate(now), sqlDate(expires)],
  );
  // No `expires` → browser-session cookie (cleared when the browser closes)
  (await cookies()).set(ADMIN_COOKIE, token, { ...baseCookie, sameSite: "strict" });
}

export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await queryOne<{
    sid: number;
    idle: number;
    id: number;
    name_enc: string;
    email_enc: string;
    role: "admin" | "staff";
    permissions: string | string[] | null;
  }>(
    `SELECT s.id AS sid, TIMESTAMPDIFF(SECOND, s.last_seen_at, UTC_TIMESTAMP()) AS idle,
            a.id, a.name_enc, a.email_enc, a.role, a.permissions
       FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP() AND a.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;
  if (row.idle > env.adminIdleMinutes * 60) {
    await exec("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = 'idle_timeout' WHERE id = ?", [row.sid]);
    return null;
  }
  if (row.idle > 30) await exec("UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?", [row.sid]);
  const raw = typeof row.permissions === "string" ? (JSON.parse(row.permissions) as string[]) : row.permissions || [];
  return {
    id: row.id,
    name: await decrypt(row.name_enc),
    email: await decrypt(row.email_enc),
    role: row.role,
    permissions: raw.filter(isPermission) as Permission[],
    sessionId: row.sid,
  };
}

export async function requireAdmin(perm?: Permission | (typeof ADMIN_ONLY)[number]): Promise<SessionAdmin> {
  const a = await getSessionAdmin();
  if (!a) throw new ApiError(401, "UNAUTHENTICATED", "Your agent session has expired. Please log in again.");
  if (perm && !can(a, perm)) throw new ApiError(403, "FORBIDDEN", "You don't have permission for this action.");
  return a;
}

export async function revokeAdminSession(sessionId: number, reason: string) {
  await exec("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoked_reason = ? WHERE id = ? AND revoked_at IS NULL", [reason, sessionId]);
}

export async function clearAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, "", { ...baseCookie, maxAge: 0 });
}
