import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { env } from "./env";

/**
 * Raw-SQL data layer (no ORM). ALWAYS use placeholders (?) — never string-concat user input.
 * mysql2 escapes every `?` value server-side-safe; identifiers are never taken from user input.
 */
declare global {
  var __skyoPool: Pool | undefined;
}

function createPool(): Pool {
  const p = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    connectionLimit: 10,
    waitForConnections: true,
    charset: "utf8mb4",
    timezone: "Z", // store/read DATETIME as UTC
    dateStrings: false,
    multipleStatements: false, // defence-in-depth against stacked-query injection
    namedPlaceholders: false,
  });
  // All DATETIME/TIMESTAMP values are UTC end-to-end (UI converts to IST for display).
  // The event hands over the core (callback) connection, so this query is fire-and-forget.
  p.on("connection", (conn) => {
    (conn as unknown as { query: (sql: string) => void }).query("SET time_zone = '+00:00'");
  });
  return p;
}

export const pool: Pool = globalThis.__skyoPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalThis.__skyoPool = pool;

type Params = (string | number | boolean | null | Date | Buffer)[];

export async function query<T = RowDataPacket>(sql: string, params: Params = []): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

export async function queryOne<T = RowDataPacket>(sql: string, params: Params = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: Params = []): Promise<ResultSetHeader> {
  const [res] = await pool.query<ResultSetHeader>(sql, params);
  return res;
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** UTC "YYYY-MM-DD HH:MM:SS" for DATETIME columns. */
export function sqlDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
