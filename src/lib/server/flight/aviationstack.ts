import "server-only";
import { exec, queryOne } from "../db";
import { encrypt } from "../crypto";
import { ApiError } from "../http";
import { getSetting } from "../settings";

/*
 * aviationstack HTTP client — the ONLY place that talks to api.aviationstack.com.
 * Docs: https://docs.apilayer.com/aviationstack/docs/aviationstack-api-v-1-0-0
 *
 * Free plan: 100 requests / month, real-time /v1/flights + catalog endpoints only,
 * 100 rows per request, /timetable & /flightsFuture are paid plans (and 1 req / 60 s on free).
 *
 * Request protection:
 *   1. kill switch     — Admin → Settings → Flights "Live flight data" off ⇒ no upstream calls
 *   2. monthly cap     — successful calls this calendar month (UTC, aviationstack's billing month) < cap
 *   3. plan gate       — paid-only endpoints are refused locally when AVIATION_PLAN=free (0 requests)
 *   4. coalescing      — identical requests in flight share ONE upstream call
 *   5. ledger          — every call (incl. errors, which aviationstack doesn't bill) is stored with its response
 * The access key is read from AVIATION_KEY on the server only and is never logged or returned.
 */

const BASE = (process.env.AVIATION_BASE_URL || "https://api.aviationstack.com/v1").trim().replace(/\/+$/, "");
const key = () => (process.env.AVIATION_KEY || "").trim();
export const aviationPlan = () => ((process.env.AVIATION_PLAN || "free").trim().toLowerCase() as "free" | "basic" | "professional" | "business");
export const aviationConfigured = () => key().length >= 16;

export type Endpoint = "flights" | "flightsFuture" | "timetable" | "routes" | "airports" | "airlines" | "airplanes" | "aircraft_types" | "cities" | "countries" | "taxes";
const PAID_ONLY = new Set<Endpoint>(["flightsFuture", "timetable", "routes"]);

export type Paged<T> = { pagination?: { limit: number; offset: number; count: number; total: number }; data: T[] };
export type AsError = { error: { code: string | number; type?: string; message?: string; info?: string } };

/** Raw /v1/flights item (times are the airport's LOCAL time even though they carry "+00:00"). */
export type AsFlight = {
  flight_date: string;
  flight_status: string | null;
  departure: { airport: string | null; timezone: string | null; iata: string | null; icao: string | null; terminal: string | null; gate: string | null; delay: number | null; scheduled: string | null; estimated: string | null; actual: string | null; estimated_runway?: string | null; actual_runway?: string | null };
  arrival: { airport: string | null; timezone: string | null; iata: string | null; icao: string | null; terminal: string | null; gate: string | null; baggage: string | null; delay: number | null; scheduled: string | null; estimated: string | null; actual: string | null; estimated_runway?: string | null; actual_runway?: string | null };
  airline: { name: string | null; iata: string | null; icao: string | null };
  flight: { number: string | null; iata: string | null; icao: string | null; codeshared: { airline_name: string; airline_iata: string; airline_icao: string; flight_number: string; flight_iata: string; flight_icao: string } | null };
  aircraft: { registration: string | null; iata: string | null; icao: string | null; icao24: string | null } | null;
  live: { updated: string; latitude: number; longitude: number; altitude: number; direction: number; speed_horizontal: number; speed_vertical: number; is_ground: boolean } | null;
};

const inflight = new Map<string, Promise<unknown>>();

/**
 * Start of the current aviationstack billing month (UTC). The plan renews on the day you subscribed
 * (Admin → Settings → Flights → "plan renews on day"), not on the 1st.
 */
export async function periodStart() {
  const day = Math.min(28, Math.max(1, parseInt(await getSetting("flight_quota_reset_day"), 10) || 1));
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  if (now.getUTCDate() < day) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")} 00:00:00`;
}

export async function requestsThisMonth() {
  const r = await queryOne<{ n: number | null }>("SELECT COUNT(*) n FROM flight_api_calls WHERE billable = 1 AND created_at >= ?", [await periodStart()]);
  return Number(r?.n || 0);
}
export async function monthlyCap() {
  return Math.max(0, parseInt(await getSetting("flight_monthly_cap"), 10) || 0);
}

function mapError(status: number, e: AsError["error"] | undefined): ApiError {
  const code = String(e?.code ?? e?.type ?? `HTTP_${status}`);
  switch (code) {
    case "usage_limit_reached":
    case "104":
      return new ApiError(429, "FLIGHT_QUOTA", "Live flight data is used up for this month. Please try again later.");
    case "function_access_restricted":
    case "105":
      return new ApiError(403, "FLIGHT_PLAN", "This flight feature needs a higher aviationstack plan.");
    case "rate_limit_reached":
    case "too_many_requests":
      return new ApiError(429, "FLIGHT_RATE", "Flight data is busy. Please try again in a minute.");
    case "invalid_access_key":
    case "missing_access_key":
    case "inactive_user":
    case "101":
    case "102":
      console.error("[aviationstack] key problem:", code);
      return new ApiError(503, "FLIGHT_UNAVAILABLE", "Flight data is temporarily unavailable. Please try again later.");
    case "validation_error":
      return new ApiError(400, "FLIGHT_VALIDATION", "Please check the flight search details.");
    default:
      return new ApiError(502, "FLIGHT_UPSTREAM", "Flight data didn't respond. Please retry.");
  }
}

/**
 * One GET to aviationstack. `reason` tells the admin ledger why the request was spent
 * (search, refresh, track, connection…).
 */
export async function aviation<T>(endpoint: Endpoint, params: Record<string, string | number | undefined | null>, meta: { reason: string; userId?: number | null; adminId?: number | null }): Promise<Paged<T>> {
  if (!aviationConfigured()) throw new ApiError(503, "FLIGHT_NOT_CONFIGURED", "Flight search is not configured yet.");
  if (PAID_ONLY.has(endpoint) && aviationPlan() === "free") throw new ApiError(403, "FLIGHT_PLAN", "This flight feature needs the aviationstack Basic plan.");
  if ((await getSetting("flight_api")) !== "on") throw new ApiError(503, "FLIGHT_DISABLED", "Live flight data is paused by the administrator.");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  qs.sort();
  const safeParams = qs.toString().slice(0, 255); // what we log — never the key
  const dedupe = `${endpoint}?${safeParams}`;
  const existing = inflight.get(dedupe);
  if (existing) return existing as Promise<Paged<T>>;

  const run = (async () => {
    const cap = await monthlyCap();
    if ((await requestsThisMonth()) >= cap) throw new ApiError(429, "FLIGHT_BUDGET", "This month's live flight lookups are used up. Cached routes still work.");
    const url = `${BASE}/${endpoint}?access_key=${encodeURIComponent(key())}${safeParams ? `&${safeParams}` : ""}`;
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    } catch (e) {
      await ledger({ endpoint, params: safeParams, status: 0, code: (e as Error).name, billable: false, count: 0, total: null, latency: Date.now() - started, meta, body: null });
      throw new ApiError(504, "FLIGHT_TIMEOUT", "Flight data took too long. Please retry.");
    }
    const latency = Date.now() - started;
    let json: (Paged<T> & Partial<AsError>) | null = null;
    try {
      json = await res.json();
    } catch {}
    if (res.ok && json && !json.error && Array.isArray(json.data)) {
      await ledger({ endpoint, params: safeParams, status: res.status, code: null, billable: true, count: json.data.length, total: json.pagination?.total ?? null, latency, meta, body: json });
      return json as Paged<T>;
    }
    // errors are not billed by aviationstack ("In the event that an error should occur, your request does not count")
    await ledger({ endpoint, params: safeParams, status: res.status, code: String(json?.error?.code ?? json?.error?.type ?? `HTTP_${res.status}`).slice(0, 48), billable: false, count: 0, total: null, latency, meta, body: json });
    throw mapError(res.status, json?.error);
  })();

  inflight.set(dedupe, run);
  try {
    return await run;
  } finally {
    inflight.delete(dedupe);
  }
}

async function ledger(r: { endpoint: string; params: string; status: number; code: string | null; billable: boolean; count: number; total: number | null; latency: number; meta: { reason: string; userId?: number | null; adminId?: number | null }; body: unknown }) {
  try {
    await exec(
      "INSERT INTO flight_api_calls (endpoint, params, http_status, error_code, billable, result_count, result_total, latency_ms, reason, user_id, admin_id, response_enc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [r.endpoint, r.params, r.status, r.code, r.billable ? 1 : 0, r.count, r.total, r.latency, r.meta.reason.slice(0, 32), r.meta.userId ?? null, r.meta.adminId ?? null, r.body ? await encrypt(JSON.stringify(r.body)) : null],
    );
  } catch (e) {
    console.error("[aviationstack] ledger write failed", (e as Error).message);
  }
}
