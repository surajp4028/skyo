/**
 * Fresh install:  npm run db:setup
 * Creates the database + v2 tables and seeds the first admin (encrypted with KMS).
 * Safe to re-run. For an existing v1 database run `npm run db:migrate-v2` instead.
 */
import { adminConnection, dbName, schemaSql } from "./_env.mjs";

const { encrypt, blindIndex, hashPassword } = await import("../src/lib/server/crypto.ts");

const boot = await adminConnection(false);
await boot.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await boot.end();

const c = await adminConnection();
const [cols] = await c.query("SHOW COLUMNS FROM users LIKE 'email_masked'").catch(() => [[]] as unknown as [unknown[]]);
if ((cols as unknown[]).length) {
  console.error("✗ This database still has the v1 schema. Run: npm run db:migrate-v2");
  process.exit(1);
}
await c.query(schemaSql());
await c.query("INSERT INTO schema_meta (meta_key, meta_value) VALUES ('version','2') ON DUPLICATE KEY UPDATE meta_value='2'");
console.log(`✓ schema v2 applied to ${dbName}`);

const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
const pass = process.env.SEED_ADMIN_PASSWORD || "";
if (email && pass) {
  const [rows] = await c.query("SELECT id FROM admins WHERE email_bidx = ?", [blindIndex("email", email)]);
  if ((rows as unknown[]).length === 0) {
    await c.query(
      "INSERT INTO admins (name_enc, email_enc, email_bidx, password_hash, role, permissions, password_changed_at) VALUES (?,?,?,?,?,?, UTC_TIMESTAMP())",
      [await encrypt("Super Admin"), await encrypt(email), blindIndex("email", email), await hashPassword(pass), "admin", "[]"],
    );
    console.log(`✓ seeded admin ${email}`);
  } else console.log(`• admin ${email} already exists`);
}
await c.query("INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('site_name', ?)", [process.env.APP_NAME_DEFAULT || "SKYO"]);
await c.end();
console.log("✓ done");
process.exit(0);
