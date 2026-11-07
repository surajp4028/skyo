import "server-only";
import { exec, query, queryOne, sqlDate } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getAllSettings, getSetting } from "../settings";
import { aviation, type AsFlight } from "./aviationstack";
import { distanceKm, HUBS } from "@/lib/flight/airports";
import { worldAirport as airportByCode } from "./world-airports";
import { aircraftFor, airlineInfo, cabinsOf, AIRCRAFT, type CabinKey } from "@/lib/flight/airlines";
import { baggageFor, isDomesticPair, optionFare, seatsLeftFor, todayIST, toMin, tzOffsetMin, type FlightChargeSettings, type FlightLeg, type FlightOption } from "@/lib/flight/model";

/* =====================================================================
 * Flight search on aviationstack's FREE plan.
 *
 * /v1/flights?dep_iata=DEL&arr_iata=BOM returns the route's flights for the current day (real-time).
 * That's the route's daily schedule: we keep it per route for `flight_cache_hours` (default 7 days)
 * and project it onto any travel date, so ONE request serves every search on that route all week.
 * On a paid plan, /v1/flightsFuture can replace this for exact future-dated schedules.
 * ===================================================================== */

type RouteCache = { legs: FlightLeg[]; sourceDate: string | null; fetchedAt: string; upstreamTotal: number | null; stale?: boolean };

/** "2026-11-07T23:50:00+00:00" → { date: "2026-11-07", time: "23:50" } (aviationstack stamps LOCAL time as +00:00). */
const localParts = (s: string | null | undefined) => (s && s.length >= 16 ? { date: s.slice(0, 10), time: s.slice(11, 16) } : null);

/** Raw rows → operating flights. Codeshare rows are folded into their operating flight. */
export function normalizeRoute(rows: AsFlight[], dep: string, arr: string): FlightLeg[] {
  const codeshares = new Map<string, string[]>();
  const legs = new Map<string, FlightLeg>();
  const depAp = airportByCode(dep);
  const arrAp = airportByCode(arr);
  const km = depAp && arrAp ? distanceKm(depAp, arrAp) : 0;

  const build = (r: AsFlight, op: { iata: string; airlineIata: string; airlineName: string; airlineIcao: string | null; number: string }): FlightLeg | null => {
    const d = localParts(r.departure.scheduled);
    const a = localParts(r.arrival.scheduled);
    if (!d || !a) return null;
    const depTz = r.departure.timezone || depAp?.tz || "Asia/Kolkata";
    const arrTz = r.arrival.timezone || arrAp?.tz || "Asia/Kolkata";
    const depUtc = Date.parse(`${d.date}T${d.time}:00Z`) - tzOffsetMin(depTz, d.date) * 60_000;
    const arrUtc = Date.parse(`${a.date}T${a.time}:00Z`) - tzOffsetMin(arrTz, a.date) * 60_000;
    const durationMin = Math.round((arrUtc - depUtc) / 60_000);
    if (!(durationMin > 15 && durationMin < 24 * 60)) return null;
    const ac = aircraftFor(op.airlineIata, km, r.aircraft?.icao);
    return {
      key: op.iata,
      airline: { iata: op.airlineIata, name: airlineInfo(op.airlineIata, op.airlineName).name, icao: op.airlineIcao },
      number: op.number,
      from: { iata: dep, airport: depAp?.name || r.departure.airport || dep, city: depAp?.city || dep, terminal: r.departure.terminal, gate: r.departure.gate, time: d.time, tz: depTz, country: depAp?.country, lat: depAp?.lat, lon: depAp?.lon },
      to: { iata: arr, airport: arrAp?.name || r.arrival.airport || arr, city: arrAp?.city || arr, terminal: r.arrival.terminal, gate: r.arrival.gate, time: a.time, tz: arrTz, country: arrAp?.country, lat: arrAp?.lat, lon: arrAp?.lon },
      dayOffset: Math.round((Date.parse(`${a.date}T00:00:00Z`) - Date.parse(`${d.date}T00:00:00Z`)) / 86400_000),
      durationMin,
      distanceKm: km,
      aircraft: { code: ac.code, name: ac.name, registration: r.aircraft?.registration ?? null },
      codeshares: [],
      status: { state: r.flight_status || "scheduled", delayMin: r.departure.delay ?? null, estimated: localParts(r.departure.estimated)?.time ?? null },
    };
  };

  for (const r of rows) {
    if ((r.departure.iata || "").toUpperCase() !== dep || (r.arrival.iata || "").toUpperCase() !== arr) continue;
    const cs = r.flight.codeshared;
    if (cs) {
      const opIata = (cs.flight_iata || "").toUpperCase();
      if (!opIata) continue;
      const list = codeshares.get(opIata) || [];
      if (r.flight.iata) list.push(r.flight.iata.toUpperCase());
      codeshares.set(opIata, list);
      if (!legs.has(opIata)) {
        const l = build(r, { iata: opIata, airlineIata: (cs.airline_iata || "").toUpperCase(), airlineName: cs.airline_name, airlineIcao: cs.airline_icao?.toUpperCase() || null, number: cs.flight_number });
        if (l) legs.set(opIata, l);
      }
      continue;
    }
    const iata = (r.flight.iata || "").toUpperCase();
    if (!iata || !r.airline.iata) continue;
    const l = build(r, { iata, airlineIata: r.airline.iata.toUpperCase(), airlineName: r.airline.name || r.airline.iata, airlineIcao: r.airline.icao, number: r.flight.number || iata.slice(2) });
    if (l) legs.set(iata, l); // the operating row wins over one synthesised from a codeshare
  }
  for (const [k, l] of legs) l.codeshares = [...new Set(codeshares.get(k) || [])].slice(0, 6);
  return [...legs.values()].sort((a, b) => toMin(a.from.time) - toMin(b.from.time));
}

const cacheHours = async () => Math.max(1, parseInt(await getSetting("flight_cache_hours"), 10) || 168);

async function readRoute(dep: string, arr: string) {
  const r = await queryOne<{ data_enc: string; fetched_at: Date; source_date: string | null; upstream_total: number | null }>(
    "SELECT data_enc, fetched_at, DATE_FORMAT(source_date, '%Y-%m-%d') source_date, upstream_total FROM flight_routes WHERE dep_iata = ? AND arr_iata = ?",
    [dep, arr],
  );
  if (!r) return null;
  try {
    return { legs: JSON.parse(await decrypt(r.data_enc)) as FlightLeg[], fetchedAt: new Date(r.fetched_at).toISOString(), sourceDate: r.source_date, upstreamTotal: r.upstream_total };
  } catch {
    return null;
  }
}

/** Fetch a route from aviationstack (1 request per page) and cache it. */
export async function refreshRoute(dep: string, arr: string, meta: { reason: string; userId?: number | null; adminId?: number | null }, pagesOverride?: number) {
  const pages = Math.min(4, Math.max(1, pagesOverride ?? (parseInt(await getSetting("flight_pages_per_route"), 10) || 1)));
  const rows: AsFlight[] = [];
  let total: number | null = null;
  for (let p = 0; p < pages; p++) {
    const r = await aviation<AsFlight>("flights", { dep_iata: dep, arr_iata: arr, limit: 100, offset: p * 100 }, meta);
    rows.push(...r.data);
    total = r.pagination?.total ?? total;
    if (!r.pagination || r.pagination.offset + r.pagination.count >= r.pagination.total) break;
  }
  const legs = normalizeRoute(rows, dep, arr);
  const sourceDate = rows[0]?.flight_date ?? null;
  await exec(
    `INSERT INTO flight_routes (dep_iata, arr_iata, flights, upstream_total, pages, source_date, data_enc, fetched_at) VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE flights = VALUES(flights), upstream_total = VALUES(upstream_total), pages = VALUES(pages), source_date = VALUES(source_date), data_enc = VALUES(data_enc), fetched_at = VALUES(fetched_at)`,
    [dep, arr, legs.length, total, pages, sourceDate, await encrypt(JSON.stringify(legs)), sqlDate()],
  );
  return { legs, fetchedAt: new Date().toISOString(), sourceDate, upstreamTotal: total } satisfies RouteCache;
}

/**
 * Cached schedule for a route. A fresh cache costs 0 requests; a missing / expired one costs 1
 * (only when allowFetch). If the refresh fails, a stale cache is still served.
 */
export async function getRoute(dep: string, arr: string, opts: { allowFetch: boolean; reason: string; userId?: number | null }): Promise<RouteCache | null> {
  const cached = await readRoute(dep, arr);
  const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < (await cacheHours()) * 3600_000;
  if (cached && (fresh || !opts.allowFetch)) return { ...cached, stale: !fresh };
  if (!opts.allowFetch) return null;
  try {
    return await refreshRoute(dep, arr, { reason: opts.reason, userId: opts.userId });
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

/* ------------------------------- itineraries ------------------------------ */

const MIN_LAYOVER = 75;
const MAX_LAYOVER = 6 * 60;

function connections(first: FlightLeg[], second: FlightLeg[]) {
  const out: { legs: [FlightLeg, FlightLeg]; layover: number }[] = [];
  for (const a of first) {
    // both times are local to the hub airport, counted from the first leg's departure day
    const arrLocal = toMin(a.to.time) + a.dayOffset * 1440;
    for (const b of second) {
      // the second leg can leave the same local day or the next
      for (const shift of [0, 1440]) {
        const lay = toMin(b.from.time) + shift - arrLocal;
        if (lay >= MIN_LAYOVER && lay <= MAX_LAYOVER) out.push({ legs: [a, b], layover: lay });
      }
    }
  }
  return out;
}

function toOption(legs: FlightLeg[], layovers: number[], date: string, s: FlightChargeSettings, today: string): FlightOption {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const durationMin = legs.reduce((a, l) => a + l.durationMin, 0) + layovers.reduce((a, l) => a + l, 0);
  const tzShift = tzOffsetMin(last.to.tz, date) - tzOffsetMin(first.from.tz, date);
  const dayOffset = Math.max(0, Math.floor((toMin(first.from.time) + durationMin + tzShift) / 1440));
  const intl = !isDomesticPair(first.from, last.to);
  const cabins = legs.map((l) => cabinsOf(AIRCRAFT[l.aircraft.code]));
  const all: CabinKey[] = (["economy", "business"] as CabinKey[]).filter((c) => cabins.every((cs) => cs.includes(c)));
  const fares: FlightOption["fares"] = {};
  for (const c of all) {
    const f = optionFare(s, legs, date, c, today);
    fares[c] = { perAdultPaise: f.perAdultPaise, basePaise: f.basePaise, taxesPaise: f.airportPaise + f.gstPaise, seatsLeft: Math.min(...legs.map((l) => seatsLeftFor(l.aircraft.code, c, l.key, date, today))) };
  }
  return {
    id: legs.map((l) => l.key).join("."), legs, layovers, stops: legs.length - 1, durationMin,
    dep: first.from.time, arr: last.to.time, dayOffset, fares,
    baggage: baggageFor(first.airline.iata, intl),
    refundable: !airlineInfo(first.airline.iata).lcc,
  };
}

export type SearchResult = {
  options: FlightOption[];
  meta: { source: "aviationstack"; fetchedAt: string | null; sourceDate: string | null; stale: boolean; devSingle: boolean; totalBeforeLimit: number; connections: boolean; routeFound: boolean };
};

/**
 * Options for dep → arr on `date`. Direct flights from the route cache (≤ 1 request if missing),
 * one-stop connections from cached hub legs (0 requests) or — if the admin allows — fetched hubs.
 */
export async function searchFlights(p: { from: string; to: string; date: string; cabin: CabinKey; userId?: number | null; allowFetch?: boolean }): Promise<SearchResult> {
  if ((await getSetting("service_flight")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Flight booking is not available.");
  const s = (await getAllSettings()) as unknown as FlightChargeSettings & Record<string, string>;
  const today = todayIST();
  const allowFetch = p.allowFetch ?? true;
  const direct = await getRoute(p.from, p.to, { allowFetch, reason: "search", userId: p.userId });
  const options: FlightOption[] = (direct?.legs || []).map((l) => toOption([l], [], p.date, s, today));

  const connOn = s.flight_connections === "on";
  if (connOn) {
    const liveHubs = Math.min(3, Math.max(0, parseInt(s.flight_connection_fetch, 10) || 0));
    let fetched = 0;
    for (const hub of HUBS) {
      if (hub === p.from || hub === p.to) continue;
      const canFetch = allowFetch && fetched < liveHubs;
      const a = await getRoute(p.from, hub, { allowFetch: canFetch, reason: "connection", userId: p.userId }).catch(() => null);
      if (!a?.legs.length) continue;
      const b = await getRoute(hub, p.to, { allowFetch: canFetch, reason: "connection", userId: p.userId }).catch(() => null);
      if (canFetch) fetched++;
      if (!b?.legs.length) continue;
      const pairs = connections(a.legs, b.legs).sort((x, y) => x.layover - y.layover).slice(0, 8);
      for (const c of pairs) options.push(toOption(c.legs, [c.layover], p.date, s, today));
    }
  }

  // drop options that already left (same-day searches)
  const nowMin = toMin(new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16));
  let list = options.filter((o) => p.date > today || toMin(o.dep) > nowMin + 60).filter((o) => o.fares[p.cabin] || o.fares.economy);
  // live status only makes sense for the date it was fetched
  if (p.date !== direct?.sourceDate) list = list.map((o) => ({ ...o, legs: o.legs.map((l) => ({ ...l, status: null })) }));
  // flights that have the requested cabin first, then cheapest
  const rank = (o: FlightOption) => (o.fares[p.cabin] ? 0 : 1e12) + (o.fares[p.cabin] ?? o.fares.economy!).perAdultPaise;
  list.sort((a, b) => rank(a) - rank(b));
  const total = list.length;
  const devSingle = (await getSetting("flight_dev_single_result")) === "on";
  if (devSingle) list = list.slice(0, 1);

  if (direct) await exec("UPDATE flight_routes SET searches = searches + 1, last_search_at = UTC_TIMESTAMP() WHERE dep_iata = ? AND arr_iata = ?", [p.from, p.to]).catch(() => {});
  return {
    options: list,
    meta: { source: "aviationstack", fetchedAt: direct?.fetchedAt ?? null, sourceDate: direct?.sourceDate ?? null, stale: !!direct?.stale, devSingle, totalBeforeLimit: total, connections: connOn, routeFound: !!direct },
  };
}

/** Re-build ONE option from the cache (booking time — never spends a request). */
export async function optionById(from: string, to: string, date: string, id: string): Promise<FlightOption | null> {
  const keys = id.split(".");
  if (keys.length < 1 || keys.length > 2 || !keys.every((k) => /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(k))) return null;
  const s = (await getAllSettings()) as unknown as FlightChargeSettings;
  const today = todayIST();
  if (keys.length === 1) {
    const r = await getRoute(from, to, { allowFetch: false, reason: "booking" });
    const leg = r?.legs.find((l) => l.key === keys[0]);
    return leg ? toOption([leg], [], date, s, today) : null;
  }
  for (const hub of HUBS) {
    const a = await getRoute(from, hub, { allowFetch: false, reason: "booking" });
    const l1 = a?.legs.find((l) => l.key === keys[0]);
    if (!l1) continue;
    const b = await getRoute(hub, to, { allowFetch: false, reason: "booking" });
    const l2 = b?.legs.find((l) => l.key === keys[1]);
    if (!l2) continue;
    const c = connections([l1], [l2])[0];
    if (c) return toOption([l1, l2], [c.layover], date, s, today);
  }
  return null;
}

/** Admin: every cached route with its age. */
export async function listCachedRoutes() {
  return query<{ dep_iata: string; arr_iata: string; flights: number; upstream_total: number | null; pages: number; source_date: string | null; searches: number; fetched_at: Date; last_search_at: Date | null }>(
    "SELECT dep_iata, arr_iata, flights, upstream_total, pages, DATE_FORMAT(source_date, '%Y-%m-%d') source_date, searches, fetched_at, last_search_at FROM flight_routes ORDER BY last_search_at DESC, fetched_at DESC LIMIT 200",
  );
}
