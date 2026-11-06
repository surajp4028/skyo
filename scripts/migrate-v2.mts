/**
 * v1 → v2 migration:  npm run db:migrate-v2
 *  - every personal value (names, emails, phones, IPs, locations, devices, audit details)
 *    is re-stored as KMS envelope ciphertext; masked columns are removed
 *  - customer ids become SKYO + 8 digits; bookings reference that id
 *  - session token hashes are kept, so signed-in users stay signed in
 * Take a backup first (mysqldump). The script refuses to run on a v2 database.
 */
import { adminConnection, schemaSql } from "./_env.mjs";

const { encrypt, encOpt, decrypt, blindIndex, bidxOpt, newSkyoId } = await import("../src/lib/server/crypto.ts");

type Row = Record<string, unknown>;
const c = await adminConnection();
const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p))[0] as Row[];

const v1 = (await q("SHOW COLUMNS FROM users LIKE 'email_masked'")).length > 0;
if (!v1) {
  console.log("• database is already v2 — nothing to do");
  process.exit(0);
}

const users = await q("SELECT * FROM users ORDER BY id");
const admins = await q("SELECT * FROM admins ORDER BY id");
const userSessions = await q("SELECT * FROM user_sessions ORDER BY id");
const adminSessions = await q("SELECT * FROM admin_sessions ORDER BY id");
const auditLogs = await q("SELECT * FROM audit_logs ORDER BY id");
const bookings = await q("SELECT COUNT(*) n FROM bookings");
if (Number(bookings[0].n) > 0) throw new Error("v1 bookings present — extend this script before migrating");
console.log(`read v1: ${users.length} users, ${admins.length} admins, ${userSessions.length + adminSessions.length} sessions, ${auditLogs.length} audit rows`);

await c.query(`SET FOREIGN_KEY_CHECKS=0;
  DROP TABLE IF EXISTS audit_logs, bookings, user_sessions, admin_sessions, otp_challenges, verification_tickets, rate_limits, users, admins;
  SET FOREIGN_KEY_CHECKS=1;`);
await c.query(schemaSql());

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const used = new Set<string>();

for (const a of admins) {
  await c.query(
    `INSERT INTO admins (id, name_enc, email_enc, email_bidx, password_hash, role, permissions, status, failed_attempts, locked_until,
                         last_login_at, last_login_ip_enc, password_changed_at, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [a.id, await encrypt(String(a.name)), await encrypt(String(a.email)), blindIndex("email", String(a.email)), a.password_hash, a.role,
     typeof a.permissions === "string" ? a.permissions : JSON.stringify(a.permissions ?? []), a.status, a.failed_attempts, a.locked_until,
     a.last_login_at, await encOpt(s(a.last_login_ip)), a.password_changed_at, a.created_by, a.created_at, a.updated_at],
  );
}

for (const u of users) {
  let uid = newSkyoId();
  while (used.has(uid)) uid = newSkyoId();
  used.add(uid);
  const email = await decrypt(s(u.email_enc));
  const phone = await decrypt(s(u.phone_enc));
  const name = s(u.name);
  await c.query(
    `INSERT INTO users (id, uid, name_enc, name_bidx, email_enc, email_bidx, email_verified_at, phone_enc, phone_bidx, phone_verified_at, status,
                        signup_method, consent_at, consent_version, signup_ip_enc, last_login_at, last_login_ip_enc, last_login_ip_bidx,
                        last_location_enc, last_device_enc, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [u.id, uid, await encOpt(name), bidxOpt("name", name), await encOpt(email), bidxOpt("email", email), u.email_verified_at,
     await encOpt(phone), bidxOpt("phone", phone), u.phone_verified_at, u.status, u.signup_method, u.consent_at, u.consent_version,
     await encOpt(s(u.signup_ip)), u.last_login_at, await encOpt(s(u.last_login_ip)), bidxOpt("ip", s(u.last_login_ip)),
     await encOpt(s(u.last_location)), await encOpt(s(u.last_device)), u.created_at, u.updated_at],
  );
  console.log(`  user #${u.id} → ${uid}`);
}

for (const [table, owner, rows] of [["user_sessions", "user_id", userSessions], ["admin_sessions", "admin_id", adminSessions]] as const) {
  for (const r of rows) {
    const extra = table === "user_sessions" ? ", client, login_method" : "";
    const vals = [r.id, r[owner], r.token_hash, await encOpt(s(r.ip)), bidxOpt("ip", s(r.ip)), await encOpt(s(r.location)), await encOpt(s(r.user_agent)),
      await encOpt(s(r.device)), ...(table === "user_sessions" ? [r.client, r.login_method] : []), r.created_at, r.last_seen_at, r.expires_at, r.revoked_at, r.revoked_reason];
    await c.query(
      `INSERT INTO ${table} (id, ${owner}, token_hash, ip_enc, ip_bidx, location_enc, user_agent_enc, device_enc${extra}, created_at, last_seen_at, expires_at, revoked_at, revoked_reason)
       VALUES (${vals.map(() => "?").join(",")})`,
      vals,
    );
  }
}

for (const l of auditLogs) {
  await c.query(
    "INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, ip_enc, user_agent_enc, meta_enc, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [l.id, l.actor_type, l.actor_id, l.action, l.target_type, l.target_id, await encOpt(s(l.ip)), await encOpt(s(l.user_agent)),
     await encOpt(l.meta === null ? null : typeof l.meta === "string" ? l.meta : JSON.stringify(l.meta)), l.created_at],
  );
}

await c.query("INSERT INTO schema_meta (meta_key, meta_value) VALUES ('version','2') ON DUPLICATE KEY UPDATE meta_value='2'");
await c.end();
console.log("✓ migrated to schema v2 (all personal data KMS-encrypted)");
process.exit(0);
