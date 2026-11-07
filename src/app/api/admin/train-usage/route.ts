import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { creditsUsedToday } from "@/lib/server/train/client";
import { getSetting } from "@/lib/server/settings";
import { railConfig } from "@/lib/server/train/config";

/** Admin: RailCore credit usage from the ledger (no train data is stored). */
export const GET = route(async () => {
  await requireAdmin("bookings.train");
  const [today, last, month, byOp, daily] = await Promise.all([
    creditsUsedToday(),
    queryOne<{ credits_remaining: number | null; day_remaining: number | null; created_at: Date }>(
      "SELECT credits_remaining, day_remaining, created_at FROM rail_api_calls WHERE credits_remaining IS NOT NULL ORDER BY id DESC LIMIT 1",
    ),
    queryOne<{ credits: number | null; calls: number; errors: number | null }>(
      "SELECT SUM(credits_cost) credits, COUNT(*) calls, SUM(http_status >= 400 OR http_status = 0) errors FROM rail_api_calls WHERE created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')",
    ),
    query<{ operation: string; calls: number; credits: number | null; avg_ms: number | null }>(
      "SELECT operation, COUNT(*) calls, SUM(credits_cost) credits, ROUND(AVG(latency_ms)) avg_ms FROM rail_api_calls WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY GROUP BY operation ORDER BY credits DESC",
    ),
    query<{ d: string; credits: number | null }>(
      "SELECT DATE_FORMAT(created_at + INTERVAL 330 MINUTE, '%Y-%m-%d') d, SUM(credits_cost) credits FROM rail_api_calls WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 14 DAY GROUP BY d ORDER BY d",
    ),
  ]);
  return ok({
    plan: railConfig.plan,
    enabled: (await getSetting("train_api")) === "on",
    devSingle: (await getSetting("train_dev_single_result")) === "on",
    dailyCap: Number(await getSetting("train_daily_credit_cap")),
    today,
    balance: last?.credits_remaining ?? null,
    dayRequestsRemaining: last?.day_remaining ?? null,
    lastCallAt: last?.created_at ?? null,
    month: { credits: Number(month?.credits || 0), calls: Number(month?.calls || 0), errors: Number(month?.errors || 0) },
    byOperation: byOp.map((r) => ({ ...r, credits: Number(r.credits || 0), calls: Number(r.calls) })),
    daily: daily.map((r) => ({ date: r.d, credits: Number(r.credits || 0) })),
  });
});
