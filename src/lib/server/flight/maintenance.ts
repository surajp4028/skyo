import "server-only";
import { exec } from "../db";
import { getSetting } from "../settings";

/*
 * Flight data retention. Runs by itself at most every 6 hours (piggy-backs on searches — no cron
 * needed) and on demand from Admin → Settings → Flights.
 *   - aviationstack responses (encrypted JSON) are cleared after `flight_log_retention_days` (default 30);
 *     the ledger row stays so the request meter and history are intact
 *   - ledger rows themselves are deleted after `flight_log_keep_days` (default 365)
 *   - live-status cache older than 2 days is dropped
 *   - seat holds of cancelled / failed / refunded / long-expired bookings are released
 *   - empty route caches (0 flights) older than the route cache window are dropped
 */
let lastRun = 0;
const EVERY_MS = 6 * 3600_000;

export async function runFlightMaintenance(force = false) {
  if (!force && Date.now() - lastRun < EVERY_MS) return null;
  lastRun = Date.now();
  const days = async (k: Parameters<typeof getSetting>[0], d: number, min: number) => Math.max(min, parseInt(await getSetting(k), 10) || d);
  const responseDays = await days("flight_log_retention_days", 30, 1);
  const keepDays = await days("flight_log_keep_days", 365, 35);
  const cacheHours = await days("flight_cache_hours", 168, 1);
  const n = async (sql: string, p: unknown[] = []) => (await exec(sql, p as never)).affectedRows;
  const result = {
    responsesCleared: await n("UPDATE flight_api_calls SET response_enc = NULL WHERE response_enc IS NOT NULL AND created_at < UTC_TIMESTAMP() - INTERVAL ? DAY", [responseDays]),
    callsDeleted: await n("DELETE FROM flight_api_calls WHERE created_at < UTC_TIMESTAMP() - INTERVAL ? DAY", [keepDays]),
    statusCacheDeleted:
      (await n("DELETE FROM flight_status_cache WHERE flight_date < UTC_DATE() - INTERVAL 2 DAY")) +
      (await n("DELETE FROM flight_board_cache WHERE fetched_at < UTC_TIMESTAMP() - INTERVAL 2 DAY")),
    seatHoldsReleased: await n(
      `DELETE h FROM flight_seat_holds h JOIN bookings b ON b.booking_ref = h.booking_ref
        WHERE b.status IN ('cancelled','failed','refunded') OR (b.status = 'pending' AND b.payment_status <> 'paid' AND b.hold_expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY)
           OR h.flight_date < UTC_DATE() - INTERVAL 7 DAY`,
    ),
    emptyRoutesDropped: await n("DELETE FROM flight_routes WHERE flights = 0 AND fetched_at < UTC_TIMESTAMP() - INTERVAL ? HOUR", [Math.max(cacheHours, 48)]),
    at: new Date().toISOString(),
  };
  return result;
}
