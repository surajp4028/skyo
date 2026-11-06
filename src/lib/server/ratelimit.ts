import "server-only";
import { exec, queryOne } from "./db";
import { sha256 } from "./crypto";

/**
 * Fixed-window limiter stored in MySQL so it works across multiple Node
 * instances (swap for Redis later without changing callers).
 * Returns { ok, retryAfter } — retryAfter in seconds.
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number) {
  const key = sha256(bucket); // never store raw IPs / identifiers
  await exec(
    `INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       hits = IF(window_start < UTC_TIMESTAMP() - INTERVAL ? SECOND, 1, hits + 1),
       window_start = IF(window_start < UTC_TIMESTAMP() - INTERVAL ? SECOND, UTC_TIMESTAMP(), window_start)`,
    [key, windowSec, windowSec],
  );
  const row = await queryOne<{ hits: number; age: number }>(
    "SELECT hits, TIMESTAMPDIFF(SECOND, window_start, UTC_TIMESTAMP()) AS age FROM rate_limits WHERE bucket = ?",
    [key],
  );
  const hits = row?.hits ?? 1;
  const retryAfter = Math.max(1, windowSec - (row?.age ?? 0));
  return { ok: hits <= limit, retryAfter, hits };
}

export async function clearRateLimit(bucket: string) {
  await exec("DELETE FROM rate_limits WHERE bucket = ?", [sha256(bucket)]);
}
