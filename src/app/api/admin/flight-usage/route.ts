import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { getSetting } from "@/lib/server/settings";
import { aviationConfigured, aviationPlan, monthlyCap, periodStart, requestsThisMonth } from "@/lib/server/flight/aviationstack";
import { listCachedRoutes } from "@/lib/server/flight/search";

/** Admin: aviationstack request meter, why each request was spent, recent calls and the cached routes. */
export const GET = route(async () => {
  await requireAdmin("bookings.flight");
  const [used, cap, byReason, recent, routes, month] = await Promise.all([
    requestsThisMonth(),
    monthlyCap(),
    query<{ reason: string | null; calls: number }>(
      "SELECT reason, COUNT(*) calls FROM flight_api_calls WHERE billable = 1 AND created_at >= ? GROUP BY reason ORDER BY calls DESC",
      [await periodStart()],
    ),
    query<{ id: number; endpoint: string; params: string; http_status: number; error_code: string | null; billable: number; result_count: number; result_total: number | null; latency_ms: number; reason: string | null; created_at: Date }>(
      "SELECT id, endpoint, params, http_status, error_code, billable, result_count, result_total, latency_ms, reason, created_at FROM flight_api_calls ORDER BY id DESC LIMIT 40",
    ),
    listCachedRoutes(),
    queryOne<{ errors: number | null; avg_ms: number | null }>(
      "SELECT SUM(billable = 0) errors, ROUND(AVG(latency_ms)) avg_ms FROM flight_api_calls WHERE created_at >= ?",
      [await periodStart()],
    ),
  ]);
  return ok({
    plan: aviationPlan(),
    configured: aviationConfigured(),
    enabled: (await getSetting("flight_api")) === "on",
    devSingle: (await getSetting("flight_dev_single_result")) === "on",
    cacheHours: Number(await getSetting("flight_cache_hours")),
    used, cap, planQuota: aviationPlan() === "free" ? 100 : null,
    errors: Number(month?.errors || 0), avgMs: month?.avg_ms ?? null, periodStart: await periodStart(),
    retentionDays: Number(await getSetting("flight_log_retention_days")),
    byReason, recent, routes,
  });
});
