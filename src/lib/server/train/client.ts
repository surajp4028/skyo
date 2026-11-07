import "server-only";
import { exec, queryOne } from "../db";
import { ApiError } from "../http";
import { getSetting } from "../settings";
import { OPS, PREMIUM_PLANS, railConfig, type Op } from "./config";
import type { Envelope, ErrorEnvelope, Meta } from "./types";

/*
 * RailCore HTTP client — the ONLY place that talks to ir.railcore.tech.
 *
 * Credit protection (Free plan = 2,500 credits/month):
 *   1. plan gate      — premium (chart) endpoints are refused locally on non-Scale keys (0 credits)
 *   2. kill switch    — Admin → Settings "Train API" off ⇒ no upstream calls
 *   3. daily cap      — sum of credits settled today (IST) from our ledger + this call's cost ≤ RK_DAILY_CREDIT_CAP
 *   4. balance floor  — if RailCore last reported fewer credits than this call costs, don't send it
 *   5. coalescing     — identical requests in flight share ONE upstream call
 *   6. retries        — only what the docs allow (429, UPSTREAM_*, METERING_UNAVAILABLE); failed calls are free
 * Responses are never cached or stored (RailCore terms: "Do not cache RailCore responses").
 * The API key is sent only from the server and never logged.
 */

export type RailResult<T> = { data: T; meta: Meta; credits: { cost: number; remaining: number | null } };

const inflight = new Map<string, Promise<RailResult<unknown>>>();

function istMidnightUtcSql(): string {
  const now = Date.now() + 5.5 * 3600_000;
  const istMidnight = Math.floor(now / 86400_000) * 86400_000 - 5.5 * 3600_000;
  return new Date(istMidnight).toISOString().slice(0, 19).replace("T", " ");
}

export async function creditsUsedToday(): Promise<number> {
  const r = await queryOne<{ n: number | null }>("SELECT SUM(credits_cost) n FROM rail_api_calls WHERE created_at >= ?", [istMidnightUtcSql()]);
  return Number(r?.n || 0);
}

async function lastKnownBalance(): Promise<number | null> {
  const r = await queryOne<{ credits_remaining: number | null }>(
    "SELECT credits_remaining FROM rail_api_calls WHERE credits_remaining IS NOT NULL ORDER BY id DESC LIMIT 1",
  );
  return r?.credits_remaining ?? null;
}

async function ledger(row: { op: string; status: number; code?: string | null; cost: number; remaining: number | null; dayRemaining: number | null; latency: number; requestId?: string | null; userId?: number | null }) {
  try {
    await exec(
      "INSERT INTO rail_api_calls (operation, http_status, error_code, credits_cost, credits_remaining, day_remaining, latency_ms, request_id, user_id) VALUES (?,?,?,?,?,?,?,?,?)",
      [row.op, row.status, row.code ?? null, row.cost, row.remaining, row.dayRemaining, row.latency, row.requestId ?? null, row.userId ?? null],
    );
  } catch (e) {
    console.error("[rail] ledger write failed", (e as Error).message);
  }
}

const num = (h: Headers, k: string) => {
  const v = h.get(k);
  return v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
};

/** Maps RailCore error codes to user-safe SKYO errors (never leaks upstream internals). */
function mapError(status: number, err: ErrorEnvelope["error"] | undefined): ApiError {
  const code = err?.code || `HTTP_${status}`;
  switch (code) {
    case "NO_TRAINS_FOUND":
      return new ApiError(404, code, "No trains found on this route for the selected date.");
    case "STATION_NOT_FOUND":
      return new ApiError(404, code, "We couldn't find that station. Pick one from the suggestions.");
    case "TRAIN_NOT_FOUND":
      return new ApiError(404, code, "We couldn't find that train number.");
    case "CHART_NOT_PREPARED":
    case "CHART_NOT_READY":
      return new ApiError(409, code, "The chart for this train isn't prepared yet.");
    case "VALIDATION_ERROR":
      return new ApiError(400, code, err?.message || "Please check the details and try again.");
    case "RATE_LIMITED":
      return new ApiError(429, code, "Train service is busy. Please try again in a minute.");
    case "CREDITS_EXHAUSTED":
    case "MISSING_API_KEY":
    case "INVALID_API_KEY":
    case "SCOPE_MISSING":
    case "PLAN_ENDPOINT_DISABLED":
    case "API_VERSION_SUNSET":
      console.error("[rail] provider config/quota error:", code);
      return new ApiError(503, "TRAIN_SERVICE_UNAVAILABLE", "Live train data is temporarily unavailable. Please try again later.");
    default:
      if (status === 404) return new ApiError(404, code, err?.message || "Not found.");
      return new ApiError(502, "TRAIN_UPSTREAM", "Live train data didn't respond. Please retry.");
  }
}

const RETRYABLE = new Set(["UPSTREAM_UNAVAILABLE", "UPSTREAM_TIMEOUT", "METERING_UNAVAILABLE", "INTERNAL"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function railRequest<T>(
  op: Op,
  path: string,
  opts: { query?: Record<string, string | number | boolean | undefined | null>; body?: unknown; method?: "GET" | "POST"; userId?: number | null; cost?: number } = {},
): Promise<RailResult<T>> {
  const spec = OPS[op];
  const cost = opts.cost ?? spec.cost;

  if (!railConfig.key) throw new ApiError(503, "TRAIN_NOT_CONFIGURED", "Train service is not configured yet.");
  if (spec.premium && !PREMIUM_PLANS.includes(railConfig.plan)) {
    throw new ApiError(403, "PLAN_REQUIRED", "This feature needs the RailCore Scale plan. It is disabled on the current plan.");
  }
  if ((await getSetting("train_api")) !== "on") throw new ApiError(503, "TRAIN_DISABLED", "Train search is paused by the administrator.");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  qs.sort();
  const url = `${railConfig.baseUrl}${path}${qs.size ? `?${qs}` : ""}`;
  const method = opts.method || (opts.body ? "POST" : "GET");
  const dedupeKey = `${method} ${url} ${opts.body ? JSON.stringify(opts.body) : ""}`;

  const existing = inflight.get(dedupeKey);
  if (existing) return existing as Promise<RailResult<T>>;

  const run = (async (): Promise<RailResult<T>> => {
    const cap = Math.max(0, parseInt(await getSetting("train_daily_credit_cap"), 10) || railConfig.dailyCreditCap);
    if ((await creditsUsedToday()) + cost > cap) {
      throw new ApiError(429, "DAILY_BUDGET_REACHED", "Today's live train lookups are used up. Please try again after midnight.");
    }
    const balance = await lastKnownBalance();
    if (balance !== null && balance < cost) {
      throw new ApiError(503, "TRAIN_SERVICE_UNAVAILABLE", "Live train data is temporarily unavailable. Please try again later.");
    }

    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: { "X-RailCore-Key": railConfig.key, Accept: "application/json", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(railConfig.timeoutMs),
          cache: "no-store",
        });
      } catch (e) {
        await ledger({ op, status: 0, code: (e as Error).name, cost: 0, remaining: null, dayRemaining: null, latency: Date.now() - started, userId: opts.userId });
        if (attempt < 2) {
          await sleep(500 * 2 ** attempt + Math.random() * 200);
          continue;
        }
        throw new ApiError(504, "TRAIN_TIMEOUT", "Live train data took too long. Please retry.");
      }
      const latency = Date.now() - started;
      const settled = res.ok ? num(res.headers, "x-railcore-credits-cost") ?? cost : 0; // only 2xx is billed
      const remaining = num(res.headers, "x-railcore-credits-remaining");
      const dayRemaining = num(res.headers, "x-railcore-ratelimit-day-remaining");
      const requestId = res.headers.get("x-railcore-request-id");
      let json: Envelope<T> | ErrorEnvelope | null = null;
      try {
        json = await res.json();
      } catch {}

      if (res.ok && json && json.success) {
        await ledger({ op, status: res.status, cost: settled, remaining, dayRemaining, latency, requestId, userId: opts.userId });
        return { data: json.data, meta: json.meta, credits: { cost: settled, remaining } };
      }

      const err = json && !json.success ? json.error : undefined;
      await ledger({ op, status: res.status, code: err?.code ?? null, cost: 0, remaining, dayRemaining, latency, requestId, userId: opts.userId });
      const retryable = res.status === 429 || (err && RETRYABLE.has(err.code));
      if (retryable && attempt < 2) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 4000) : 500 * 2 ** attempt + Math.random() * 250;
        if (res.status === 429 && wait >= 4000) throw mapError(429, err);
        await sleep(wait);
        continue;
      }
      if (requestId) console.warn(`[rail] ${op} failed ${res.status} ${err?.code ?? ""} request_id=${requestId}`);
      throw mapError(res.status, err);
    }
  })();

  inflight.set(dedupeKey, run as Promise<RailResult<unknown>>);
  try {
    return await run;
  } finally {
    inflight.delete(dedupeKey);
  }
}
