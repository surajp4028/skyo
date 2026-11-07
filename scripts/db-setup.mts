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

// v2.1: booking payment / ticket columns for databases created before them
const bookingCols: [string, string][] = [
  ["pay_provider", "VARCHAR(16) NULL AFTER currency"],
  ["pay_order_id", "VARCHAR(64) NULL AFTER pay_provider"],
  ["pay_payment_id", "VARCHAR(64) NULL AFTER pay_order_id"],
  ["paid_at", "DATETIME NULL AFTER pay_payment_id"],
  ["ticket_status", "ENUM('not_issued','issued','failed') NOT NULL DEFAULT 'not_issued' AFTER paid_at"],
  ["pnr_enc", "TEXT NULL AFTER ticket_status"],
  ["issued_at", "DATETIME NULL AFTER pnr_enc"],
  ["hold_expires_at", "DATETIME NULL AFTER issued_at"],
  ["ticket_key_enc", "TEXT NULL AFTER hold_expires_at"],
  ["charges_enc", "TEXT NULL AFTER ticket_key_enc"],
];
const addCols = async (table: string, cols: [string, string][]) => {
  for (const [col, def] of cols) {
    const [rows] = await c.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [col]);
    if ((rows as unknown[]).length === 0) {
      await c.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`✓ ${table}.${col} added`);
    }
  }
};
await addCols("bookings", bookingCols);
// default coupons (editable in Admin → Settings → Coupons; can be paused, not deleted)
await c.query(
  `INSERT IGNORE INTO coupons (code, title, discount_type, value, apply_on, service, per_user_limit, total_limit, is_default) VALUES
   ('SKYO10', '10% off your booking', 'percent', 10, 'total', 'train', 5, NULL, 1),
   ('SKYOZERO', 'Zero SKYO service fee', 'zero_service', 0, 'service_fee', 'train', NULL, NULL, 1)`,
);
await addCols("admins", [
  ["avatar_key_enc", "TEXT NULL"],
  ["avatar_updated_at", "DATETIME NULL"],
]);
await c.query("ALTER TABLE payment_logs MODIFY provider ENUM('razorpay','tripgic','skyo','digio') NOT NULL");
await addCols("users", [
  ["billing_enc", "TEXT NULL"],
  ["avatar_key_enc", "TEXT NULL"],
  ["avatar_updated_at", "DATETIME NULL"],
]);
const [idx] = await c.query("SHOW INDEX FROM bookings WHERE Key_name = 'uq_booking_pay_order'");
if ((idx as unknown[]).length === 0) await c.query("ALTER TABLE bookings ADD UNIQUE KEY uq_booking_pay_order (pay_order_id)");
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
