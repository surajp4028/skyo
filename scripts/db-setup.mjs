/**
 * Creates the database + tables and seeds the first admin.
 *   npm run db:setup
 * Safe to re-run (CREATE IF NOT EXISTS; admin only seeded if missing).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const cfg = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
};
const dbName = process.env.DB_NAME || "skyo";
if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error("Invalid DB_NAME");

function scrypt(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${dbName}\``);
await conn.query("SET time_zone = '+00:00'");
await conn.query(fs.readFileSync(path.join(root, "database/schema.sql"), "utf8"));
console.log(`✓ schema applied to ${dbName}`);

const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
const pass = process.env.SEED_ADMIN_PASSWORD || "";
if (email && pass) {
  const [rows] = await conn.query("SELECT id FROM admins WHERE email = ?", [email]);
  if (rows.length === 0) {
    await conn.query(
      "INSERT INTO admins (name, email, password_hash, role, permissions, password_changed_at) VALUES (?,?,?,?,?, UTC_TIMESTAMP())",
      ["Super Admin", email, scrypt(pass), "admin", JSON.stringify([])],
    );
    console.log(`✓ seeded admin ${email}`);
  } else console.log(`• admin ${email} already exists`);
}

await conn.query(
  "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('site_name', ?)",
  [process.env.APP_NAME_DEFAULT || "SKYO"],
);
await conn.end();
console.log("✓ done");
