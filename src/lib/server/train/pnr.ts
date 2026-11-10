import "server-only";
import { checkPNRStatus, configure } from "railkit";
import { exec, query, queryOne, sqlDate } from "../db";
import { blindIndex, decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getSetting } from "../settings";

/*
 * PNR status via RailKit (https://railkit.in/docs) — the ONLY place that talks to RailKit.
 *
 * We use RailKit's official SDK (`railkit`, pinned to an exact version): its requests are signed by the SDK
 * itself. The SDK was reviewed before install — it only imports node:crypto and calls https://api.railkit.in.
 * The key is read from RAILKIT on the server only, never logged, never sent to the browser.
 *
 * Request protection (RailKit plans have a monthly quota → 429 "Usage limit exceeded"):
 *   1. kill switch   — Admin → Settings → Trains "Live PNR data" off ⇒ no RailKit calls
 *   2. cache         — the same PNR is served from cache for `pnr_cache_min` (longer once the chart is
 *                      prepared, and a day once the journey is over)
 *   3. per person    — fresh lookups per logged-in user / per visitor IP per IST day
 *   4. monthly cap   — billable calls since the plan renewal day < `pnr_monthly_cap`
 *   5. coalescing    — two people asking for the same PNR at once share one call
 *   6. ledger        — every call is stored (PNR as keyed hash + last 4 digits, response encrypted)
 */

const key = () => (process.env.RAILKIT || process.env.RAILKIT_API_KEY || "").trim();
export const railkitConfigured = () => key().length >= 16;

let configuredWith = "";
function sdk() {
  const k = key();
  if (k !== configuredWith) {
    configure(k);
    configuredWith = k;
  }
}

// ------------------------------------------------------------------ types

export type PnrStatusCode = string; // CNF, RAC, WL, GNWL, PQWL, TQWL, RLWL, CAN …
export type PnrBerth = { status: PnrStatusCode; coach: string | null; berth: number | null; berthCode: string | null; text: string };
export type PnrPassenger = { n: number; booking: PnrBerth; current: PnrBerth };
export type PnrView = {
  pnr: string;
  train: { number: string; name: string };
  journey: {
    date: string | null; // local IST "YYYY-MM-DDTHH:mm"
    dateText: string | null;
    arrival: string | null;
    arrivalText: string | null;
    cls: string | null;
    quota: string | null;
    from: { code: string; name: string } | null;
    to: { code: string; name: string } | null;
    boarding: { code: string; name: string } | null;
    distanceKm: number | null;
  };
  chart: { prepared: boolean; text: string };
  booking: { fare: number | null; ticketFare: number | null; date: string | null };
  passengers: PnrPassenger[];
};
export type PnrResult = { data: PnrView; fetchedAt: string; cached: boolean; stale: boolean; nextRefreshAt: string; note?: string };

// ------------------------------------------------------------------ helpers

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** "22 Aug 2026, 04:35:00 pm" → "2026-08-22T16:35" (IST wall clock). */
export function parseRailkitDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?)?/i);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  let h = m[4] ? parseInt(m[4], 10) : 0;
  const ap = m[6]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${m[3]}-${pad(mon)}-${pad(parseInt(m[1], 10))}T${pad(h)}:${m[5] ?? "00"}`;
}
/** IST wall-clock "YYYY-MM-DDTHH:mm" → UTC Date. */
const istToDate = (s: string) => new Date(`${s}:00+05:30`);

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : null);
const stn = (v: unknown) => {
  const o = obj(v);
  const code = str(o.code);
  return code ? { code: code.toUpperCase(), name: str(o.name) || code } : null;
};
function berth(v: unknown): PnrBerth {
  const o = obj(v);
  const text = str(o.details) || "";
  return { status: (str(o.status) || text.split(/[\s/,]/)[0] || "—").toUpperCase(), coach: str(o.coach), berth: num(o.berthNo), berthCode: str(o.berthCode), text };
}

/** Our own shape — the browser never sees RailKit's raw payload. */
export function normalizePnr(pnr: string, raw: unknown): PnrView {
  const d = obj(raw);
  const t = obj(d.train);
  const j = obj(d.journey);
  const b = obj(d.booking);
  const chartText = str(obj(d.chart).status) || "Chart not prepared";
  const pax = Array.isArray(d.passengers) ? d.passengers : [];
  return {
    pnr,
    train: { number: str(t.number) || "", name: str(t.name) || "" },
    journey: {
      date: parseRailkitDate(j.dateOfJourney),
      dateText: str(j.dateOfJourney),
      arrival: parseRailkitDate(j.arrivalDate),
      arrivalText: str(j.arrivalDate),
      cls: str(j.class),
      quota: str(j.quota),
      from: stn(j.source),
      to: stn(j.destination),
      boarding: stn(j.boardingPoint),
      distanceKm: num(j.distance),
    },
    chart: { prepared: /prepared/i.test(chartText) && !/not\s+prepared/i.test(chartText), text: chartText },
    booking: { fare: num(b.fare), ticketFare: num(b.ticketFare), date: str(b.bookingDate) },
    passengers: pax.map((p, i) => {
      const o = obj(p);
      const n = parseInt(String(o.serialNumber ?? "").replace(/\D+/g, ""), 10);
      return { n: Number.isFinite(n) && n > 0 ? n : i + 1, booking: berth(o.booking), current: berth(o.current) };
    }),
  };
}

function istMidnightUtcSql(): string {
  const now = Date.now() + 5.5 * 3600_000;
  const istMidnight = Math.floor(now / 86400_000) * 86400_000 - 5.5 * 3600_000;
  return sqlDate(new Date(istMidnight));
}

/** Start of the current RailKit billing month — the plan renews on `pnr_quota_reset_day`. */
export async function pnrPeriodStart() {
  const day = Math.min(28, Math.max(1, parseInt(await getSetting("pnr_quota_reset_day"), 10) || 1));
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
  return `${y}-${pad(m + 1)}-${pad(day)} 00:00:00`;
}
export async function pnrRequestsThisPeriod() {
  const r = await queryOne<{ n: number | null }>("SELECT COUNT(*) n FROM pnr_api_calls WHERE billable = 1 AND created_at >= ?", [await pnrPeriodStart()]);
  return Number(r?.n || 0);
}
export const pnrMonthlyCap = async () => Math.max(0, parseInt(await getSetting("pnr_monthly_cap"), 10) || 0);

/** How long a cached status stays good: short while waitlists move, longer after charting, a day after travel. */
async function ttlMinutes(view: PnrView) {
  const base = Math.max(5, parseInt(await getSetting("pnr_cache_min"), 10) || 30);
  const end = view.journey.arrival || view.journey.date;
  if (end && istToDate(end).getTime() < Date.now() - 6 * 3600_000) return 24 * 60;
  if (view.chart.prepared) return Math.max(base, 120);
  return base;
}

// ------------------------------------------------------------------ maintenance

let lastMaintenance = 0;
export async function runPnrMaintenance(force = false) {
  if (!force && Date.now() - lastMaintenance < 6 * 3600_000) return null;
  lastMaintenance = Date.now();
  const days = Math.max(1, parseInt(await getSetting("pnr_log_retention_days"), 10) || 30);
  const cut = sqlDate(new Date(Date.now() - days * 86400_000));
  const a = await exec("UPDATE pnr_api_calls SET response_enc = NULL WHERE response_enc IS NOT NULL AND created_at < ?", [cut]);
  const b = await exec("DELETE FROM pnr_api_calls WHERE created_at < ?", [sqlDate(new Date(Date.now() - 365 * 86400_000))]);
  const c = await exec("DELETE FROM pnr_cache WHERE fetched_at < ?", [cut]);
  return { responsesCleared: a.affectedRows, callsDeleted: b.affectedRows, cacheDeleted: c.affectedRows };
}

// ------------------------------------------------------------------ the lookup

const inflight = new Map<string, Promise<PnrView>>();

async function ledger(r: { hash: string; pnr: string; status: number | null; code: string | null; billable: boolean; latency: number; userId: number | null; ipHash: string | null; body: unknown }) {
  try {
    await exec(
      "INSERT INTO pnr_api_calls (pnr_hash, pnr_last4, http_status, error_code, billable, latency_ms, user_id, ip_hash, response_enc) VALUES (?,?,?,?,?,?,?,?,?)",
      [r.hash, r.pnr.slice(-4), r.status, r.code?.slice(0, 64) ?? null, r.billable ? 1 : 0, r.latency, r.userId, r.ipHash, r.body ? await encrypt(JSON.stringify(r.body)) : null],
    );
  } catch (e) {
    console.error("[railkit] ledger write failed", (e as Error).message);
  }
}

function mapError(status: number | null, message: string): ApiError {
  const m = message.toLowerCase();
  if (status === 401 || status === 403 || m.includes("api key")) {
    console.error("[railkit] key problem:", status, message.slice(0, 80));
    return new ApiError(503, "PNR_UNAVAILABLE", "PNR status is temporarily unavailable. Please try again later.");
  }
  if (status === 429 || m.includes("usage limit")) return new ApiError(429, "PNR_QUOTA", "This month's PNR lookups are used up. Please try again later.");
  if (status === 404 || m.includes("not found") || m.includes("invalid pnr") || m.includes("flushed") || m.includes("does not exist"))
    return new ApiError(404, "PNR_NOT_FOUND", "We couldn't find this PNR. Check the 10 digits — PNRs also expire a while after the journey.");
  if (m.includes("timed out") || m.includes("timeout")) return new ApiError(504, "PNR_TIMEOUT", "The railways took too long to answer. Please retry in a minute.");
  return new ApiError(502, "PNR_UPSTREAM", "Couldn't get the PNR status right now. Please retry.");
}

async function fetchFromRailkit(pnr: string, hash: string, who: { userId: number | null; ipHash: string | null }): Promise<PnrView> {
  if (!railkitConfigured()) throw new ApiError(503, "PNR_NOT_CONFIGURED", "PNR status is not configured yet.");
  sdk();
  const started = Date.now();
  type SdkReply = { success?: boolean; data?: unknown; error?: string; statusCode?: number } | null;
  let res: SdkReply;
  try {
    res = (await Promise.race([
      checkPNRStatus(pnr),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Request timed out")), 20_000)),
    ])) as SdkReply;
  } catch (e) {
    await ledger({ hash, pnr, status: null, code: (e as Error).message, billable: false, latency: Date.now() - started, ...who, body: null });
    throw mapError(null, (e as Error).message);
  }
  const latency = Date.now() - started;
  const status = typeof res?.statusCode === "number" ? res.statusCode : res?.success ? 200 : null;
  if (res?.success && res.data) {
    await ledger({ hash, pnr, status, code: null, billable: true, latency, ...who, body: res });
    return normalizePnr(pnr, res.data);
  }
  const msg = String(res?.error || "Unknown error");
  // a call RailKit answered counts against the quota unless it was refused for the key/quota itself
  const billable = status !== null && status < 500 && ![401, 403, 429].includes(status);
  await ledger({ hash, pnr, status, code: msg, billable, latency, ...who, body: res });
  throw mapError(status, msg);
}

export async function lookupPnr(pnr: string, opts: { refresh?: boolean; userId: number | null; ip: string }): Promise<PnrResult> {
  if ((await getSetting("service_train")) !== "on" || (await getSetting("pnr_status")) !== "on") throw new ApiError(404, "SERVICE_OFF", "PNR status isn't available right now.");
  void runPnrMaintenance().catch((e) => console.error("[railkit] maintenance", (e as Error).message));

  const hash = blindIndex("pnr", pnr);
  const ipHash = opts.userId ? null : blindIndex("ip", opts.ip);
  const row = await queryOne<{ data_enc: string; fetched_at: Date }>("SELECT data_enc, fetched_at FROM pnr_cache WHERE pnr_hash = ?", [hash]);
  let cached: PnrView | null = null;
  if (row) {
    try {
      cached = JSON.parse(await decrypt(row.data_enc)) as PnrView;
    } catch {
      cached = null;
    }
  }
  const fromCache = async (stale: boolean, note?: string): Promise<PnrResult> => {
    const ttl = await ttlMinutes(cached!);
    const fetched = new Date(row!.fetched_at);
    return { data: cached!, fetchedAt: fetched.toISOString(), cached: true, stale, nextRefreshAt: new Date(fetched.getTime() + ttl * 60_000).toISOString(), note };
  };
  if (cached && Date.now() - new Date(row!.fetched_at).getTime() < (await ttlMinutes(cached)) * 60_000) return fromCache(false);

  // a request would be spent from here on
  if ((await getSetting("pnr_api")) !== "on") {
    if (cached) return fromCache(true, "Live PNR updates are paused — showing the last status we have.");
    throw new ApiError(503, "PNR_DISABLED", "PNR status is paused by the administrator.");
  }
  const limit = Math.max(0, parseInt(await getSetting(opts.userId ? "pnr_user_daily" : "pnr_guest_daily"), 10) || 0);
  if (!opts.userId && limit === 0) {
    if (cached) return fromCache(true, "Log in to get a fresher status.");
    throw new ApiError(401, "LOGIN_REQUIRED", "Log in to check PNR status.");
  }
  const used = await queryOne<{ n: number | null }>(
    `SELECT COUNT(*) n FROM pnr_api_calls WHERE billable = 1 AND ${opts.userId ? "user_id = ?" : "ip_hash = ?"} AND created_at >= ?`,
    [opts.userId ?? ipHash, istMidnightUtcSql()],
  );
  if (Number(used?.n || 0) >= limit) {
    if (cached) return fromCache(true, "You've used today's fresh PNR checks — this is the last status we fetched.");
    throw new ApiError(429, opts.userId ? "PNR_DAILY_LIMIT" : "LOGIN_FOR_MORE", opts.userId ? "You've checked a lot of PNRs today. Please try again tomorrow." : "Log in to check more PNRs today.");
  }
  if ((await pnrRequestsThisPeriod()) >= (await pnrMonthlyCap())) {
    if (cached) return fromCache(true, "Live PNR checks are used up for this month — showing the last status we have.");
    throw new ApiError(429, "PNR_BUDGET", "This month's PNR lookups are used up. Please try again later.");
  }

  let run = inflight.get(hash);
  if (!run) {
    run = fetchFromRailkit(pnr, hash, { userId: opts.userId, ipHash });
    inflight.set(hash, run);
    run.finally(() => inflight.delete(hash)).catch(() => {});
  }
  let view: PnrView;
  try {
    view = await run;
  } catch (e) {
    // upstream hiccup but we have an older answer — better than an error
    if (cached && e instanceof ApiError && e.status >= 500) return fromCache(true, "The railways didn't answer just now — showing the last status we have.");
    throw e;
  }
  const now = new Date();
  await exec(
    "INSERT INTO pnr_cache (pnr_hash, data_enc, journey_at, fetched_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data_enc = VALUES(data_enc), journey_at = VALUES(journey_at), fetched_at = VALUES(fetched_at)",
    [hash, await encrypt(JSON.stringify(view)), view.journey.date ? sqlDate(istToDate(view.journey.date)) : null, sqlDate(now)],
  );
  return { data: view, fetchedAt: now.toISOString(), cached: false, stale: false, nextRefreshAt: new Date(now.getTime() + (await ttlMinutes(view)) * 60_000).toISOString() };
}

/** Admin meter. */
export async function pnrUsage() {
  const start = await pnrPeriodStart();
  const [used, cap, today, month, recent, cache] = await Promise.all([
    pnrRequestsThisPeriod(),
    pnrMonthlyCap(),
    queryOne<{ n: number | null }>("SELECT COUNT(*) n FROM pnr_api_calls WHERE billable = 1 AND created_at >= ?", [istMidnightUtcSql()]),
    queryOne<{ errors: number | null; avg_ms: number | null; users: number | null }>(
      "SELECT SUM(billable = 0) errors, ROUND(AVG(latency_ms)) avg_ms, COUNT(DISTINCT COALESCE(CONCAT('u', user_id), ip_hash)) users FROM pnr_api_calls WHERE created_at >= ?",
      [start],
    ),
    query<{ id: number; pnr_last4: string; http_status: number | null; error_code: string | null; billable: number; latency_ms: number | null; user_id: number | null; created_at: Date }>(
      "SELECT id, pnr_last4, http_status, error_code, billable, latency_ms, user_id, created_at FROM pnr_api_calls ORDER BY id DESC LIMIT 30",
    ),
    queryOne<{ n: number | null }>("SELECT COUNT(*) n FROM pnr_cache"),
  ]);
  return {
    configured: railkitConfigured(),
    periodStart: start,
    used,
    cap,
    today: Number(today?.n || 0),
    errors: Number(month?.errors || 0),
    avgMs: month?.avg_ms != null ? Number(month.avg_ms) : null,
    people: Number(month?.users || 0),
    cached: Number(cache?.n || 0),
    recent: recent.map((r) => ({ ...r, billable: !!r.billable, created_at: new Date(r.created_at).toISOString() })),
  };
}

// ------------------------------------------------------------------ "Your PNRs" (logged-in travellers)

const MAX_SAVED = 10;
export type SavedPnr = { pnr: string; data: PnrView | null; fetchedAt: string | null; nextRefreshAt: string | null };

/** Remember a PNR the user checked (latest status included). Keeps the 10 most recent. */
export async function saveUserPnr(userId: number, pnr: string, r: PnrResult | null) {
  const hash = blindIndex("pnr", pnr);
  const snap = r ? await encrypt(JSON.stringify(r.data)) : null;
  await exec(
    `INSERT INTO user_pnrs (user_id, pnr_hash, pnr_enc, snapshot_enc, fetched_at, journey_at) VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE snapshot_enc = COALESCE(VALUES(snapshot_enc), snapshot_enc), fetched_at = COALESCE(VALUES(fetched_at), fetched_at),
       journey_at = COALESCE(VALUES(journey_at), journey_at), updated_at = CURRENT_TIMESTAMP`,
    [userId, hash, await encrypt(pnr), snap, r ? sqlDate(new Date(r.fetchedAt)) : null, r?.data.journey.date ? sqlDate(istToDate(r.data.journey.date)) : null],
  );
  // trim to the newest MAX_SAVED
  await exec(
    `DELETE FROM user_pnrs WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM user_pnrs WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ${MAX_SAVED}) keep)`,
    [userId, userId],
  );
}

export async function removeUserPnr(userId: number, pnr: string) {
  const r = await exec("DELETE FROM user_pnrs WHERE user_id = ? AND pnr_hash = ?", [userId, blindIndex("pnr", pnr)]);
  return r.affectedRows > 0;
}

/** The user's saved PNRs with the freshest status we hold (theirs or a newer shared cache entry). No RailKit calls. */
export async function listUserPnrs(userId: number): Promise<SavedPnr[]> {
  // journeys that ended over 3 days ago drop off the list
  await exec("DELETE FROM user_pnrs WHERE user_id = ? AND journey_at IS NOT NULL AND journey_at < ?", [userId, sqlDate(new Date(Date.now() - 3 * 86400_000))]);
  const rows = await query<{ pnr_enc: string; snapshot_enc: string | null; fetched_at: Date | null; c_data: string | null; c_at: Date | null }>(
    `SELECT u.pnr_enc, u.snapshot_enc, u.fetched_at, c.data_enc c_data, c.fetched_at c_at
       FROM user_pnrs u LEFT JOIN pnr_cache c ON c.pnr_hash = u.pnr_hash
      WHERE u.user_id = ? ORDER BY u.updated_at DESC, u.id DESC LIMIT ${MAX_SAVED}`,
    [userId],
  );
  const out: SavedPnr[] = [];
  for (const r of rows) {
    try {
      const pnr = await decrypt(r.pnr_enc);
      const useCache = r.c_data && r.c_at && (!r.fetched_at || new Date(r.c_at) > new Date(r.fetched_at));
      const enc = useCache ? r.c_data : r.snapshot_enc;
      const at = useCache ? r.c_at : r.fetched_at;
      const data = enc ? (JSON.parse(await decrypt(enc)) as PnrView) : null;
      const fetchedAt = at ? new Date(at) : null;
      out.push({
        pnr,
        data,
        fetchedAt: fetchedAt?.toISOString() ?? null,
        nextRefreshAt: data && fetchedAt ? new Date(fetchedAt.getTime() + (await ttlMinutes(data)) * 60_000).toISOString() : null,
      });
    } catch {
      /* unreadable row (key rotation) — skip */
    }
  }
  return out;
}
