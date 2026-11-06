import "server-only";
import { query, queryOne } from "../db";
import { blindIndex, decrypt } from "../crypto";
import { parseIdentifier } from "../validators";
import type { ServiceKey } from "@/lib/permissions";

/* Admin-only read models. Every query is parameterised; LIMIT/OFFSET are clamped integers. */

export function paging(sp: URLSearchParams, defSize = 20) {
  const page = Math.max(1, Math.min(10_000, parseInt(sp.get("page") || "1", 10) || 1));
  const size = Math.max(5, Math.min(100, parseInt(sp.get("size") || String(defSize), 10) || defSize));
  return { page, size, offset: (page - 1) * size };
}

export async function dashboardStats() {
  const [u] = await query<{ total: number; active: number; today: number; week: number }>(
    `SELECT COUNT(*) total, SUM(status='active') active,
            SUM(created_at >= UTC_DATE()) today, SUM(created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY) week FROM users`,
  );
  const [s] = await query<{ live: number; logins24: number }>(
    `SELECT SUM(revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() AND last_seen_at > UTC_TIMESTAMP() - INTERVAL 30 MINUTE) live,
            SUM(created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY) logins24 FROM user_sessions`,
  );
  const byService = await query<{ service: ServiceKey; n: number; revenue: number }>(
    "SELECT service, COUNT(*) n, COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount_paise END),0) revenue FROM bookings GROUP BY service",
  );
  const signups = await query<{ d: string; n: number }>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d, COUNT(*) n FROM users
      WHERE created_at >= UTC_DATE() - INTERVAL 13 DAY GROUP BY d ORDER BY d`,
  );
  const recent = await query<{ uid: string; name: string | null; email_masked: string | null; phone_masked: string | null; last_location: string | null; created_at: Date }>(
    "SELECT uid, name, email_masked, phone_masked, last_location, created_at FROM users ORDER BY id DESC LIMIT 6",
  );
  return {
    users: { total: Number(u?.total || 0), active: Number(u?.active || 0), today: Number(u?.today || 0), week: Number(u?.week || 0) },
    sessions: { live: Number(s?.live || 0), logins24: Number(s?.logins24 || 0) },
    byService: byService.map((r) => ({ service: r.service, count: Number(r.n), revenuePaise: Number(r.revenue) })),
    signups: signups.map((r) => ({ date: r.d, count: Number(r.n) })),
    recent,
  };
}

export async function listUsers(sp: URLSearchParams, unmask: boolean) {
  const { page, size, offset } = paging(sp);
  const where: string[] = [];
  const params: (string | number)[] = [];
  const q = (sp.get("q") || "").trim().slice(0, 100);
  if (q) {
    const id = parseIdentifier(q);
    if (id) {
      where.push(`${id.channel === "email" ? "email_bidx" : "phone_bidx"} = ?`);
      params.push(blindIndex(id.channel, id.value));
    } else {
      where.push("(name LIKE ? OR uid = ? OR last_login_ip = ?)");
      params.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`, q.toUpperCase(), q);
    }
  }
  const status = sp.get("status");
  if (status === "active" || status === "inactive" || status === "blocked") {
    where.push("status = ?");
    params.push(status);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM users ${w}`, params))?.n ?? 0;
  const rows = await query<{
    id: number; uid: string; name: string | null; email_enc: string | null; phone_enc: string | null; email_masked: string | null; phone_masked: string | null;
    email_verified_at: Date | null; phone_verified_at: Date | null; status: string; signup_method: string; last_login_at: Date | null; last_login_ip: string | null;
    last_location: string | null; last_device: string | null; created_at: Date; active_sessions: number;
  }>(
    `SELECT u.id, u.uid, u.name, u.email_enc, u.phone_enc, u.email_masked, u.phone_masked, u.email_verified_at, u.phone_verified_at, u.status,
            u.signup_method, u.last_login_at, u.last_login_ip, u.last_location, u.last_device, u.created_at,
            (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) active_sessions
       FROM users u ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const users = await Promise.all(
    rows.map(async ({ email_enc, phone_enc, ...r }) => ({
      ...r,
      email: unmask ? await decrypt(email_enc) : r.email_masked,
      phone: unmask ? await decrypt(phone_enc) : r.phone_masked,
      active_sessions: Number(r.active_sessions),
    })),
  );
  return { users, total: Number(total), page, size };
}

export async function getUserDetail(id: number, unmask: boolean) {
  const u = await queryOne<Record<string, unknown> & { email_enc: string | null; phone_enc: string | null }>(
    `SELECT id, uid, name, email_enc, phone_enc, email_masked, phone_masked, email_verified_at, phone_verified_at, status, signup_method,
            consent_at, consent_version, signup_ip, last_login_at, last_login_ip, last_location, last_device, created_at FROM users WHERE id = ?`,
    [id],
  );
  if (!u) return null;
  const { email_enc, phone_enc, ...rest } = u;
  const sessions = await query(
    `SELECT id, ip, location, device, client, login_method, created_at, last_seen_at, expires_at, revoked_at, revoked_reason,
            (revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()) AS active
       FROM user_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
    [id],
  );
  const bookings = await query(
    "SELECT booking_ref, service, status, title, travel_date, amount_paise, created_at FROM bookings WHERE user_id = ? ORDER BY id DESC LIMIT 20",
    [id],
  );
  return {
    user: { ...rest, email: unmask ? await decrypt(email_enc) : rest.email_masked, phone: unmask ? await decrypt(phone_enc) : rest.phone_masked },
    sessions,
    bookings,
  };
}

export async function listSessions(sp: URLSearchParams) {
  const { page, size, offset } = paging(sp, 25);
  const kind = sp.get("kind") === "admin" ? "admin" : "user";
  const onlyActive = sp.get("active") === "1";
  const q = (sp.get("q") || "").trim().slice(0, 60);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (onlyActive) where.push("s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()");
  if (q) {
    where.push(kind === "admin" ? "(s.ip = ? OR a.email LIKE ? OR a.name LIKE ?)" : "(s.ip = ? OR u.uid = ? OR u.name LIKE ?)");
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    params.push(q, kind === "admin" ? like : q.toUpperCase(), like);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql =
    kind === "admin"
      ? `FROM admin_sessions s JOIN admins a ON a.id = s.admin_id ${w}`
      : `FROM user_sessions s JOIN users u ON u.id = s.user_id ${w}`;
  const cols =
    kind === "admin"
      ? "s.id, a.id AS owner_id, a.name, a.email AS contact, a.role, s.ip, s.location, s.device, 'web' AS client, 'password' AS login_method"
      : "s.id, u.id AS owner_id, u.name, COALESCE(u.email_masked, u.phone_masked) AS contact, u.uid AS role, s.ip, s.location, s.device, s.client, s.login_method";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n ${sql}`, params))?.n ?? 0;
  const rows = await query(
    `SELECT ${cols}, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at, s.revoked_reason,
            (s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) AS active ${sql} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  return { kind, sessions: rows, total: Number(total), page, size };
}

export async function listBookings(service: ServiceKey, sp: URLSearchParams) {
  const { page, size, offset } = paging(sp);
  const where = ["b.service = ?"];
  const params: (string | number)[] = [service];
  const st = sp.get("status");
  if (st && ["pending", "confirmed", "cancelled", "failed", "refunded"].includes(st)) {
    where.push("b.status = ?");
    params.push(st);
  }
  const q = (sp.get("q") || "").trim().slice(0, 60);
  if (q) {
    where.push("(b.booking_ref = ? OR b.title LIKE ? OR b.provider_ref = ?)");
    params.push(q.toUpperCase(), `%${q.replace(/[%_\\]/g, "\\$&")}%`, q);
  }
  const w = "WHERE " + where.join(" AND ");
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM bookings b ${w}`, params))?.n ?? 0;
  const rows = await query(
    `SELECT b.id, b.booking_ref, b.status, b.payment_status, b.title, b.origin, b.destination, b.travel_date, b.travellers,
            b.amount_paise, b.provider, b.created_at, u.id AS user_id, u.name AS user_name, u.uid AS user_uid
       FROM bookings b JOIN users u ON u.id = b.user_id ${w} ORDER BY b.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const [sum] = await query<{ confirmed: number; pending: number; cancelled: number; revenue: number }>(
    `SELECT SUM(status='confirmed') confirmed, SUM(status='pending') pending, SUM(status IN ('cancelled','refunded')) cancelled,
            COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount_paise END),0) revenue FROM bookings WHERE service = ?`,
    [service],
  );
  return {
    bookings: rows,
    total: Number(total),
    page,
    size,
    summary: { confirmed: Number(sum?.confirmed || 0), pending: Number(sum?.pending || 0), cancelled: Number(sum?.cancelled || 0), revenuePaise: Number(sum?.revenue || 0) },
  };
}

export async function listAudit(sp: URLSearchParams) {
  const { page, size, offset } = paging(sp, 30);
  const where: string[] = [];
  const params: (string | number)[] = [];
  const actor = sp.get("actor");
  if (actor === "user" || actor === "admin" || actor === "system") {
    where.push("l.actor_type = ?");
    params.push(actor);
  }
  const action = (sp.get("action") || "").trim().slice(0, 40);
  if (action) {
    where.push("l.action LIKE ?");
    params.push(`${action.replace(/[%_\\]/g, "\\$&")}%`);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs l ${w}`, params))?.n ?? 0;
  const rows = await query(
    `SELECT l.id, l.actor_type, l.actor_id, l.action, l.target_type, l.target_id, l.ip, l.meta, l.created_at,
            CASE l.actor_type WHEN 'admin' THEN a.name WHEN 'user' THEN COALESCE(u.name, u.uid) ELSE 'system' END AS actor_name
       FROM audit_logs l
       LEFT JOIN admins a ON l.actor_type = 'admin' AND a.id = l.actor_id
       LEFT JOIN users u ON l.actor_type = 'user' AND u.id = l.actor_id
       ${w} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  return { logs: rows, total: Number(total), page, size };
}
