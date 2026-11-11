import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

/** Loads .env.local/.env before any app module reads process.env. */
export const root = path.resolve(import.meta.dirname, "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

export const dbName = process.env.DB_NAME || "skyo";
if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error("Invalid DB_NAME");

export async function adminConnection(withDb = true) {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    ssl: process.env.DB_SSL === "true"
      ? (process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : { rejectUnauthorized: false })
      : undefined,
    multipleStatements: true,
    timezone: "Z",
    ...(withDb ? { database: dbName } : {}),
  });
  await c.query("SET time_zone = '+00:00'");
  return c;
}

export const schemaSql = () => fs.readFileSync(path.join(root, "database/schema.sql"), "utf8");
export const packageSchemaSql = () =>
  ["003_tour_packages.sql", "004_package_departures.sql"].map((f) => fs.readFileSync(path.join(root, "database/migrations", f), "utf8")).join("\n");
