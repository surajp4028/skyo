import "server-only";
import { exec, query, queryOne } from "../db";
import { payInfo, type PayInfo } from "@/lib/payment-method";
import { blindIndex, decrypt, isSkyoId } from "../crypto";
import { maskEmail, maskPhone, parseIdentifier } from "../validators";
import type { ServiceKey } from "@/lib/permissions";

/*
 * Admin-only read models. Data is stored KMS-encrypted; values are decrypted here
 * for authorised agents. Admins (and staff with `users.contact`) see full values;
 * other staff get masked contact details.
 * Search is exact-match through blind indexes (encrypted data can't be LIKE-searched).
 */

export function paging(sp: URLSearchParams, defSize = 20) {
  const page = Math.max(1, Math.min(10_000, parseInt(sp.get("page") || "1", 10) || 1));
  const size = Math.max(5, Math.min(100, parseInt(sp.get("size") || String(defSize), 10) || defSize));
  return { page, size, offset: (page - 1) * size };
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]{3,45}$/i;

async function contact(emailEnc: string | null, phoneEnc: string | null, full: boolean) {
  const [email, phone] = await Promise.all([decrypt(emailEnc), decrypt(phoneEnc)]);
  return {
    email: email ? (full ? email : maskEmail(email)) : null,
    phone: phone ? (full ? phone : maskPhone(phone)) : null,
  };
}

/** Builds a WHERE clause for user search: SKYO id, email, mobile, IP or exact full name. */
function userSearch(q: string, alias = "u") {
  const v = q.trim();
  if (!v) return null;
  if (isSkyoId(v)) return { sql: `${alias}.uid = ?`, params: [v.toUpperCase()] };
  const id = parseIdentifier(v);
  if (id) return { sql: `${alias}.${id.channel === "email" ? "email_bidx" : "phone_bidx"} = ?`, params: [blindIndex(id.channel, id.value)] };
  if (IP_RE.test(v)) return { sql: `${alias}.last_login_ip_bidx = ?`, params: [blindIndex("ip", v)] };
  return { sql: `${alias}.name_bidx = ?`, params: [blindIndex("name", v)] };
}

export async function dashboardStats(full: boolean) {
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
  const recentRows = await query<{ id: number; uid: string; name_enc: string | null; email_enc: string | null; phone_enc: string | null; last_location_enc: string | null; created_at: Date }>(
    "SELECT id, uid, name_enc, email_enc, phone_enc, last_location_enc, created_at FROM users ORDER BY id DESC LIMIT 6",
  );
  const recent = await Promise.all(
    recentRows.map(async (r) => ({
      id: r.id,
      uid: r.uid,
      name: (await decrypt(r.name_enc)) || null,
      location: (await decrypt(r.last_location_enc)) || null,
      created_at: r.created_at,
      ...(await contact(r.email_enc, r.phone_enc, full)),
    })),
  );
  return {
    users: { total: Number(u?.total || 0), active: Number(u?.active || 0), today: Number(u?.today || 0), week: Number(u?.week || 0) },
    sessions: { live: Number(s?.live || 0), logins24: Number(s?.logins24 || 0) },
    byService: byService.map((r) => ({ service: r.service, count: Number(r.n), revenuePaise: Number(r.revenue) })),
    signups: signups.map((r) => ({ date: r.d, count: Number(r.n) })),
    recent,
  };
}

export async function listUsers(sp: URLSearchParams, full: boolean) {
  const { page, size, offset } = paging(sp);
  const where: string[] = [];
  const params: (string | number)[] = [];
  const search = userSearch((sp.get("q") || "").slice(0, 100));
  if (search) {
    where.push(search.sql);
    params.push(...search.params);
  }
  const status = sp.get("status");
  if (status === "active" || status === "inactive" || status === "blocked") {
    where.push("u.status = ?");
    params.push(status);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM users u ${w}`, params))?.n ?? 0;
  const rows = await query<{
    id: number; uid: string; name_enc: string | null; email_enc: string | null; phone_enc: string | null; email_verified_at: Date | null; phone_verified_at: Date | null;
    status: string; signup_method: string; last_login_at: Date | null; last_login_ip_enc: string | null; last_location_enc: string | null; last_device_enc: string | null;
    created_at: Date; active_sessions: number; bookings: number; has_avatar: number; avatar_updated_at: Date | null;
  }>(
    `SELECT u.id, u.uid, u.name_enc, u.email_enc, u.phone_enc, u.email_verified_at, u.phone_verified_at, u.status, u.signup_method,
            u.last_login_at, u.last_login_ip_enc, u.last_location_enc, u.last_device_enc, u.created_at,
            (u.avatar_key_enc IS NOT NULL) has_avatar, u.avatar_updated_at,
            (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) active_sessions,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_uid = u.uid) bookings
       FROM users u ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const users = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      uid: r.uid,
      name: (await decrypt(r.name_enc)) || null,
      ...(await contact(r.email_enc, r.phone_enc, full)),
      email_verified_at: r.email_verified_at,
      phone_verified_at: r.phone_verified_at,
      status: r.status,
      signup_method: r.signup_method,
      last_login_at: r.last_login_at,
      last_login_ip: (await decrypt(r.last_login_ip_enc)) || null,
      last_location: (await decrypt(r.last_location_enc)) || null,
      last_device: (await decrypt(r.last_device_enc)) || null,
      created_at: r.created_at,
      active_sessions: Number(r.active_sessions),
      bookings: Number(r.bookings),
      avatar: r.has_avatar ? adminAvatarUrl(r.id, r.avatar_updated_at) : null,
    })),
  );
  return { users, total: Number(total), page, size };
}

export async function getUserDetail(id: number, full: boolean) {
  const u = await queryOne<{
    id: number; uid: string; name_enc: string | null; email_enc: string | null; phone_enc: string | null; email_verified_at: Date | null; phone_verified_at: Date | null;
    status: string; signup_method: string; consent_at: Date | null; consent_version: string | null; signup_ip_enc: string | null; last_login_at: Date | null;
    last_login_ip_enc: string | null; last_location_enc: string | null; last_device_enc: string | null; created_at: Date; has_avatar: number; avatar_updated_at: Date | null;
  }>(
    `SELECT id, uid, name_enc, email_enc, phone_enc, email_verified_at, phone_verified_at, status, signup_method, consent_at, consent_version,
            signup_ip_enc, last_login_at, last_login_ip_enc, last_location_enc, last_device_enc, created_at,
            (avatar_key_enc IS NOT NULL) has_avatar, avatar_updated_at FROM users WHERE id = ?`,
    [id],
  );
  if (!u) return null;
  const sessRows = await query<{
    id: number; ip_enc: string | null; location_enc: string | null; device_enc: string | null; user_agent_enc: string | null; client: string; login_method: string;
    created_at: Date; last_seen_at: Date; expires_at: Date; revoked_at: Date | null; revoked_reason: string | null; active: number;
  }>(
    `SELECT id, ip_enc, location_enc, device_enc, user_agent_enc, client, login_method, created_at, last_seen_at, expires_at, revoked_at, revoked_reason,
            (revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()) AS active
       FROM user_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
    [id],
  );
  const bookRows = await query<{ booking_ref: string; service: string; status: string; title_enc: string; travel_date: Date | null; amount_paise: number; created_at: Date }>(
    "SELECT booking_ref, service, status, title_enc, travel_date, amount_paise, created_at FROM bookings WHERE user_uid = ? ORDER BY id DESC LIMIT 20",
    [u.uid],
  );
  return {
    user: {
      id: u.id,
      uid: u.uid,
      name: (await decrypt(u.name_enc)) || null,
      ...(await contact(u.email_enc, u.phone_enc, full)),
      email_verified_at: u.email_verified_at,
      phone_verified_at: u.phone_verified_at,
      status: u.status,
      signup_method: u.signup_method,
      consent_at: u.consent_at,
      consent_version: u.consent_version,
      signup_ip: (await decrypt(u.signup_ip_enc)) || null,
      last_login_at: u.last_login_at,
      last_login_ip: (await decrypt(u.last_login_ip_enc)) || null,
      last_location: (await decrypt(u.last_location_enc)) || null,
      last_device: (await decrypt(u.last_device_enc)) || null,
      created_at: u.created_at,
      avatar: u.has_avatar ? adminAvatarUrl(u.id, u.avatar_updated_at) : null,
    },
    sessions: await Promise.all(
      sessRows.map(async ({ ip_enc, location_enc, device_enc, user_agent_enc, ...r }) => ({
        ...r,
        active: Number(r.active),
        ip: await decrypt(ip_enc),
        location: (await decrypt(location_enc)) || null,
        device: (await decrypt(device_enc)) || "Unknown",
        user_agent: await decrypt(user_agent_enc),
      })),
    ),
    bookings: await Promise.all(bookRows.map(async ({ title_enc, ...b }) => ({ ...b, title: await decrypt(title_enc) }))),
  };
}

export async function listSessions(sp: URLSearchParams, full: boolean) {
  const { page, size, offset } = paging(sp, 25);
  const kind = sp.get("kind") === "admin" ? "admin" : "user";
  const onlyActive = sp.get("active") === "1";
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (onlyActive) where.push("s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()");
  if (q) {
    if (IP_RE.test(q) && !/^\d{10}$/.test(q)) {
      where.push("s.ip_bidx = ?");
      params.push(blindIndex("ip", q));
    } else if (kind === "admin") {
      where.push("a.email_bidx = ?");
      params.push(blindIndex("email", q));
    } else {
      const s = userSearch(q, "u");
      if (s) {
        where.push(s.sql);
        params.push(...s.params);
      }
    }
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const from = kind === "admin" ? `FROM admin_sessions s JOIN admins a ON a.id = s.admin_id ${w}` : `FROM user_sessions s JOIN users u ON u.id = s.user_id ${w}`;
  const cols =
    kind === "admin"
      ? "a.id AS owner_id, a.name_enc, a.email_enc, NULL AS phone_enc, a.role AS ref, 'web' AS client, 'password' AS login_method"
      : "u.id AS owner_id, u.name_enc, u.email_enc, u.phone_enc, u.uid AS ref, s.client, s.login_method";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n ${from}`, params))?.n ?? 0;
  const rows = await query<{
    id: number; owner_id: number; name_enc: string | null; email_enc: string | null; phone_enc: string | null; ref: string; client: string; login_method: string;
    ip_enc: string | null; location_enc: string | null; device_enc: string | null; created_at: Date; last_seen_at: Date; expires_at: Date; revoked_at: Date | null; revoked_reason: string | null; active: number;
  }>(
    `SELECT s.id, ${cols}, s.ip_enc, s.location_enc, s.device_enc, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at, s.revoked_reason,
            (s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) AS active ${from} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const sessions = await Promise.all(
    rows.map(async (r) => {
      const c = await contact(r.email_enc, r.phone_enc, full || kind === "admin");
      return {
        id: r.id,
        owner_id: r.owner_id,
        name: (await decrypt(r.name_enc)) || null,
        contact: c.email || (c.phone ? `+91 ${c.phone}` : null),
        ref: r.ref,
        client: r.client,
        login_method: r.login_method,
        ip: await decrypt(r.ip_enc),
        location: (await decrypt(r.location_enc)) || null,
        device: (await decrypt(r.device_enc)) || "Unknown",
        created_at: r.created_at,
        last_seen_at: r.last_seen_at,
        revoked_at: r.revoked_at,
        revoked_reason: r.revoked_reason,
        active: Number(r.active),
      };
    }),
  );
  return { kind, sessions, total: Number(total), page, size };
}

export async function listBookings(service: ServiceKey, sp: URLSearchParams) {
  await exec("UPDATE bookings SET status = 'cancelled' WHERE status = 'pending' AND payment_status IN ('unpaid','failed') AND hold_expires_at < UTC_TIMESTAMP() - INTERVAL 10 MINUTE");
  const { page, size, offset } = paging(sp);
  const where = ["b.service = ?"];
  const params: (string | number)[] = [service];
  const st = sp.get("status");
  if (st && ["pending", "confirmed", "cancelled", "failed", "refunded"].includes(st)) {
    where.push("b.status = ?");
    params.push(st);
  } else if (st === "action") {
    // paid but no ticket and nothing refunded yet → an agent must act
    where.push("b.payment_status = 'paid' AND b.ticket_status <> 'issued' AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status <> 'failed')");
  } else if (st === "refund_pending") {
    where.push("EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'pending')");
  }
  const range = sp.get("range");
  if (range === "today") where.push("b.created_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY");
  else if (range === "7d") where.push("b.created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY");
  else if (range === "30d") where.push("b.created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY");
  const q = (sp.get("q") || "").trim().slice(0, 60);
  if (q) {
    if (isSkyoId(q)) {
      where.push("b.user_uid = ?");
      params.push(q.toUpperCase());
    } else {
      where.push("(b.booking_ref = ? OR b.provider_ref_bidx = ?)");
      params.push(q.toUpperCase(), blindIndex("ref", q));
    }
  }
  const w = "WHERE " + where.join(" AND ");
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM bookings b ${w}`, params))?.n ?? 0;
  const rows = await query<{
    id: number; booking_ref: string; status: string; payment_status: string; title_enc: string; origin_enc: string | null; destination_enc: string | null; provider_ref_enc: string | null;
    travel_date: Date | null; travellers: number; amount_paise: number; provider: string | null; created_at: Date; ticket_status: string; pay_payment_id: string | null; user_id: number; user_uid: string; user_name_enc: string | null;
    hold_expires_at: Date | null; refund_processed: number | null; refund_pending: number | null;
  }>(
    `SELECT b.id, b.booking_ref, b.status, b.payment_status, b.title_enc, b.origin_enc, b.destination_enc, b.provider_ref_enc, b.travel_date, b.travellers,
            b.amount_paise, b.provider, b.created_at, b.ticket_status, b.pay_payment_id, b.hold_expires_at, u.id AS user_id, b.user_uid, u.name_enc AS user_name_enc,
            (SELECT SUM(r.amount_paise) FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'processed') AS refund_processed,
            (SELECT SUM(r.amount_paise) FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'pending') AS refund_pending
       FROM bookings b JOIN users u ON u.uid = b.user_uid ${w} ORDER BY b.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const bookings = await Promise.all(
    rows.map(async ({ title_enc, origin_enc, destination_enc, provider_ref_enc, user_name_enc, refund_processed, refund_pending, ...r }) => ({
      ...r,
      refund: { processed: Number(refund_processed || 0), pending: Number(refund_pending || 0) },
      title: await decrypt(title_enc),
      origin: (await decrypt(origin_enc)) || null,
      destination: (await decrypt(destination_enc)) || null,
      provider_ref: (await decrypt(provider_ref_enc)) || null,
      user_name: (await decrypt(user_name_enc)) || null,
    })),
  );
  // payment instrument (card network / UPI / bank) from the captured Razorpay payment we stored
  const pids = bookings.map((b) => b.pay_payment_id).filter(Boolean) as string[];
  if (pids.length) {
    const atts = await query<{ payment_id: string; data_enc: string | null }>(`SELECT payment_id, data_enc FROM payment_attempts WHERE payment_id IN (${pids.map(() => "?").join(",")})`, pids);
    const map = new Map<string, PayInfo | null>();
    for (const a of atts) {
      try {
        map.set(a.payment_id, payInfo(JSON.parse((await decrypt(a.data_enc)) || "null")));
      } catch {}
    }
    for (const b of bookings) (b as typeof b & { pay?: PayInfo | null }).pay = b.pay_payment_id ? map.get(b.pay_payment_id) ?? null : null;
  }
  const [chips] = await query<{ all: number; confirmed: number; pending: number; failed: number; cancelled: number; refunded: number; action: number; refund_pending: number }>(
    `SELECT COUNT(*) \`all\`, SUM(b.status='confirmed') confirmed, SUM(b.status='pending') pending, SUM(b.status='failed') failed, SUM(b.status='cancelled') cancelled, SUM(b.status='refunded') refunded,
            SUM(b.payment_status='paid' AND b.ticket_status <> 'issued' AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status <> 'failed')) action,
            SUM(EXISTS (SELECT 1 FROM refunds r WHERE r.booking_ref = b.booking_ref AND r.status = 'pending')) refund_pending
       FROM bookings b WHERE b.service = ?`,
    [service],
  );
  const [sum] = await query<{ confirmed: number; pending: number; cancelled: number; revenue: number }>(
    `SELECT SUM(status='confirmed') confirmed, SUM(status='pending') pending, SUM(status IN ('cancelled','refunded')) cancelled,
            COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount_paise END),0) revenue FROM bookings WHERE service = ?`,
    [service],
  );
  return {
    bookings,
    total: Number(total),
    page,
    size,
    summary: { confirmed: Number(sum?.confirmed || 0), pending: Number(sum?.pending || 0), cancelled: Number(sum?.cancelled || 0), revenuePaise: Number(sum?.revenue || 0) },
    counts: Object.fromEntries(Object.entries(chips || {}).map(([k, v]) => [k, Number(v || 0)])) as Record<string, number>,
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
  const rows = await query<{
    id: number; actor_type: string; actor_id: number | null; action: string; target_type: string | null; target_id: string | null; ip_enc: string | null; meta_enc: string | null;
    created_at: Date; admin_name_enc: string | null; user_name_enc: string | null; user_uid: string | null;
  }>(
    `SELECT l.id, l.actor_type, l.actor_id, l.action, l.target_type, l.target_id, l.ip_enc, l.meta_enc, l.created_at,
            a.name_enc AS admin_name_enc, u.name_enc AS user_name_enc, u.uid AS user_uid
       FROM audit_logs l
       LEFT JOIN admins a ON l.actor_type = 'admin' AND a.id = l.actor_id
       LEFT JOIN users u ON l.actor_type = 'user' AND u.id = l.actor_id
       ${w} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const logs = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      actor_name:
        r.actor_type === "admin" ? await decrypt(r.admin_name_enc) : r.actor_type === "user" ? (await decrypt(r.user_name_enc)) || r.user_uid : "system",
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      ip: (await decrypt(r.ip_enc)) || null,
      meta: (await decrypt(r.meta_enc)) || null,
      created_at: r.created_at,
    })),
  );
  return { logs, total: Number(total), page, size };
}

/** Admin-side URL for a customer's private profile photo (served after a users.view check). */
export const adminAvatarUrl = (userId: number, updated: Date | null) => `/api/admin/users/${userId}/avatar?v=${updated ? new Date(updated).getTime() : 0}`;
