import "server-only";
import { exec, query, queryOne, sqlDate } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getAllSettings, getSetting } from "../settings";
import { aviation, type AsFlight } from "./aviationstack";
import { distanceKm, HUBS } from "@/lib/flight/airports";
import { nearbyAirports, worldAirport as airportByCode } from "./world-airports";
import { runFlightMaintenance } from "./maintenance";
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

/** Routes with no flights today are re-checked after a day (small airports fly only on some days). */
const freshHours = (hours: number, flights: number) => (flights ? hours : Math.min(hours, 24));
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
  const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < freshHours(await cacheHours(), cached.legs.length) * 3600_000;
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

/** International hubs used for 1-stop trips abroad (Indian hubs come from HUBS). */
const MEGA_HUBS = new Set(["DXB", "DOH", "AUH", "IST", "SIN", "BKK", "KUL", "HKG", "ICN", "PEK", "PVG", "NRT", "FRA", "LHR", "CDG", "AMS"]);
const INTL_HUBS = ["DXB", "DOH", "AUH", "IST", "SIN", "BKK", "KUL", "HKG", "ICN", "PEK", "PVG", "CAN", "NRT", "FRA", "LHR", "CDG", "AMS", "JFK", "CMB", "KTM"];

/**
 * Hubs worth connecting through, best first: the detour (via hub ÷ direct distance) must stay small,
 * so DEL → UBN tries Beijing / Seoul, not Dubai.
 */
export function hubCandidates(from: string, to: string, limit = 8) {
  const a = airportByCode(from);
  const b = airportByCode(to);
  if (!a || !b) return [];
  const direct = Math.max(1, distanceKm(a, b));
  const abroad = a.country !== "IN" || b.country !== "IN";
  return [...new Set([...HUBS, ...INTL_HUBS])]
    .filter((h) => h !== from && h !== to)
    .map((h) => ({ h, ap: airportByCode(h) }))
    .filter((x) => x.ap)
    .map(({ h, ap }) => {
      const detour = (distanceKm(a, ap!) + distanceKm(ap!, b)) / direct;
      // abroad, big carriers' hubs are where real connections happen — prefer them over a nearby small airport
      return { iata: h, city: ap!.city, detour, score: detour - (abroad && MEGA_HUBS.has(h) ? 0.45 : 0) };
    })
    .filter((x) => x.detour <= (abroad ? 2.2 : 1.45))
    .sort((x, y) => x.score - y.score)
    .slice(0, limit);
}

const MIN_LAYOVER = 70;
const MAX_LAYOVER = 12 * 60; // international self-transfers can need a long wait

/**
 * Layovers for a chain of legs (each leg must leave the hub after the previous one lands),
 * or null if any connection is too tight / too long. Times are local to the hub airport.
 */
function chain(legs: FlightLeg[]): number[] | null {
  const lays: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    const a = legs[i - 1];
    const b = legs[i];
    const arrLocal = toMin(a.to.time) + a.dayOffset * 1440;
    let best: number | null = null;
    for (const shift of [0, 1440, 2880]) {
      const lay = toMin(b.from.time) + shift - arrLocal;
      if (lay >= MIN_LAYOVER && lay <= MAX_LAYOVER) {
        best = lay;
        break;
      }
    }
    if (best === null) return null;
    lays.push(best);
  }
  return lays;
}

/** Adjacency of every cached route that has flights: dep → [arr]. 0 requests. */
async function cachedGraph() {
  const rows = await query<{ dep_iata: string; arr_iata: string }>("SELECT dep_iata, arr_iata FROM flight_routes WHERE flights > 0");
  const adj = new Map<string, string[]>();
  for (const r of rows) adj.set(r.dep_iata, [...(adj.get(r.dep_iata) || []), r.arr_iata]);
  return adj;
}

/** Airport paths from → … → to with up to `maxStops` stops over cached routes, shortest detour first. */
function routePaths(adj: Map<string, string[]>, from: string, to: string, maxStops = 2) {
  const a = airportByCode(from);
  const b = airportByCode(to);
  const direct = a && b ? Math.max(1, distanceKm(a, b)) : 0;
  const len = (path: string[]) => path.slice(1).reduce((acc, c, i) => {
    const x = airportByCode(path[i]);
    const y = airportByCode(c);
    return acc + (x && y ? distanceKm(x, y) : 0);
  }, 0);
  const out: string[][] = [];
  for (const h1 of adj.get(from) || []) {
    if (h1 === to) continue;
    if ((adj.get(h1) || []).includes(to)) out.push([from, h1, to]);
    if (maxStops < 2) continue;
    for (const h2 of adj.get(h1) || []) if (h2 !== from && h2 !== to && h2 !== h1 && (adj.get(h2) || []).includes(to)) out.push([from, h1, h2, to]);
  }
  return out
    .map((p) => ({ p, ratio: direct ? len(p) / direct : 1 }))
    .filter((x) => x.ratio <= 2.6)
    .sort((x, y) => x.p.length - y.p.length || x.ratio - y.ratio)
    .slice(0, 12)
    .map((x) => x.p);
}

/** Best itineraries along one airport path (greedy: for each first leg, the tightest valid onward legs). */
async function itinerariesFor(path: string[], load: (dep: string, arr: string) => Promise<FlightLeg[]>) {
  const legsBy = await Promise.all(path.slice(1).map((arr, i) => load(path[i], arr)));
  if (legsBy.some((l) => !l.length)) return [];
  const out: { legs: FlightLeg[]; layovers: number[] }[] = [];
  const extend = (sofar: FlightLeg[]) => {
    if (sofar.length === legsBy.length) {
      const lays = chain(sofar);
      if (lays) out.push({ legs: sofar, layovers: lays });
      return;
    }
    const next = legsBy[sofar.length]
      .map((l) => ({ l, lays: chain([...sofar.slice(-1), l]) }))
      .filter((x) => x.lays)
      .sort((x, y) => x.lays![0] - y.lays![0])
      .slice(0, sofar.length === legsBy.length - 1 ? 2 : 1);
    for (const n of next) extend([...sofar, n.l]);
  };
  for (const first of legsBy[0]) extend([first]);
  const total = (x: { legs: FlightLeg[]; layovers: number[] }) => x.legs.reduce((a, l) => a + l.durationMin, 0) + x.layovers.reduce((a, l) => a + l, 0);
  return out.sort((x, y) => total(x) - total(y)).slice(0, 8);
}

/** Route loader with a per-search memo (each route is decrypted once). */
function routeLoader() {
  const memo = new Map<string, Promise<FlightLeg[]>>();
  return (dep: string, arr: string) => {
    const k = `${dep}-${arr}`;
    if (!memo.has(k)) memo.set(k, readRoute(dep, arr).then((r) => r?.legs ?? []));
    return memo.get(k)!;
  };
}

/** Big airport travellers would fly to instead of a small regional field (ULO → UBN). */
export function gatewayFor(code: string) {
  const ap = airportByCode(code);
  if (!ap) return null;
  if (MEGA_HUBS.has(code) || HUBS.includes(code) || /international/i.test(ap.name)) return null;
  const big = nearbyAirports(code, 1600).filter((x) => MEGA_HUBS.has(x.iata) || HUBS.includes(x.iata) || /international/i.test(x.name));
  // same country first (Ulaangom → Ulaanbaatar, not Urumqi), then the nearest anywhere
  const near = big.find((x) => x.country === ap.country) ?? big[0];
  return near ? { iata: near.iata, city: near.city, km: near.km } : null;
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
  meta: { source: "aviationstack"; fetchedAt: string | null; sourceDate: string | null; stale: boolean; devSingle: boolean; totalBeforeLimit: number; connections: boolean; routeFound: boolean; directCount: number; suggestHubs: { iata: string; city: string }[]; gateway: { iata: string; city: string; km: number } | null };
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
  void runFlightMaintenance().catch((e) => console.error("[flight] maintenance", (e as Error).message));
  const direct = await getRoute(p.from, p.to, { allowFetch, reason: "search", userId: p.userId });
  const options: FlightOption[] = (direct?.legs || []).map((l) => toOption([l], [], p.date, s, today));

  const connOn = s.flight_connections === "on";
  if (connOn) {
    // optional: let the admin spend a few requests on the best hubs (Settings → Flights)
    const liveHubs = Math.min(3, Math.max(0, parseInt(s.flight_connection_fetch, 10) || 0));
    if (allowFetch && liveHubs && !(direct?.legs.length)) {
      for (const { iata: hub } of hubCandidates(p.from, p.to, liveHubs)) {
        const a = await getRoute(p.from, hub, { allowFetch: true, reason: "connection", userId: p.userId }).catch(() => null);
        if (a?.legs.length) await getRoute(hub, p.to, { allowFetch: true, reason: "connection", userId: p.userId }).catch(() => null);
      }
    }
    // 1- and 2-stop itineraries over EVERY cached route (0 requests)
    const load = routeLoader();
    const seen = new Set(options.map((o) => o.id));
    for (const path of routePaths(await cachedGraph(), p.from, p.to)) {
      for (const it of await itinerariesFor(path, load)) {
        const o = toOption(it.legs, it.layovers, p.date, s, today);
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        options.push(o);
      }
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
    meta: { source: "aviationstack", fetchedAt: direct?.fetchedAt ?? null, sourceDate: direct?.sourceDate ?? null, stale: !!direct?.stale, devSingle, totalBeforeLimit: total, connections: connOn, routeFound: !!direct,
      directCount: direct?.legs.length ?? 0, suggestHubs: total ? [] : hubCandidates(p.from, gatewayFor(p.to)?.iata ?? p.to, 3).map(({ iata, city }) => ({ iata, city })), gateway: gatewayFor(p.to) },
  };
}

/** Re-build ONE option from the cache (booking time — never spends a request). Walks the cached routes leg by leg. */
export async function optionById(from: string, to: string, date: string, id: string): Promise<FlightOption | null> {
  const keys = id.split(".");
  if (keys.length < 1 || keys.length > 3 || !keys.every((k) => /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(k))) return null;
  const s = (await getAllSettings()) as unknown as FlightChargeSettings;
  const today = todayIST();
  const adj = await cachedGraph();
  const load = routeLoader();
  const legs: FlightLeg[] = [];
  let cur = from;
  for (const [i, key] of keys.entries()) {
    const targets = i === keys.length - 1 ? [to] : (adj.get(cur) || []).filter((x) => x !== to);
    let hit: FlightLeg | undefined;
    for (const arr of targets) {
      hit = (await load(cur, arr)).find((l) => l.key === key);
      if (hit) {
        cur = arr;
        break;
      }
    }
    if (!hit) return null;
    legs.push(hit);
  }
  const lays = chain(legs);
  return lays ? toOption(legs, lays, date, s, today) : null;
}

/**
 * Traveller asked for connections on a route with no direct flight: spend a SMALL, fixed number of
 * aviationstack requests on the most likely legs (origin → hub → gateway → destination), cache them,
 * then search again over the cache. Routes already cached cost nothing.
 */
export async function exploreConnections(p: { from: string; to: string; date: string; cabin: CabinKey; userId: number | null; budget: number }) {
  const gw = gatewayFor(p.to);
  const target = gw?.iata ?? p.to;
  // hub chains, most likely first: [from → gateway → to], then [from → hub → target (→ to)]
  const chains: [string, string][][] = [];
  if (gw) chains.push([[p.from, gw.iata], [gw.iata, p.to]]);
  for (const h of hubCandidates(p.from, target, 3).map((x) => x.iata)) chains.push([[p.from, h], [h, target], ...(gw ? ([[gw.iata, p.to]] as [string, string][]) : [])]);
  let spent = 0;
  let error: string | null = null;
  const checked: string[] = [];
  const hours = await cacheHours();
  const fresh = async (d: string, a: string) => {
    const c = await readRoute(d, a);
    return c && Date.now() - Date.parse(c.fetchedAt) < freshHours(hours, c.legs.length) * 3600_000 ? c : null;
  };
  const found = async () => (await searchFlights({ from: p.from, to: p.to, date: p.date, cabin: p.cabin, userId: p.userId, allowFetch: false })).meta.totalBeforeLimit > 0;

  outer: for (const legs of chains) {
    for (const [d, a] of legs) {
      let legs2 = (await fresh(d, a))?.legs;
      if (!legs2) {
        if (spent >= p.budget) break outer;
        try {
          legs2 = (await refreshRoute(d, a, { reason: "explore", userId: p.userId }, 1)).legs;
          spent++;
        } catch (e) {
          error = (e as Error).message;
          break outer; // monthly cap / provider error — use what we have
        }
      }
      checked.push(`${d}-${a}`);
      if (!legs2.length) continue outer; // no flights on this leg today — try the next hub, don't buy the onward leg
    }
    if (await found()) break; // stop as soon as one hub gives a real connection
  }
  const r = await searchFlights({ from: p.from, to: p.to, date: p.date, cabin: p.cabin, userId: p.userId, allowFetch: false });
  return { ...r, explored: { spent, checked, error } };
}

/** Admin: every cached route with its age. */
export async function listCachedRoutes() {
  return query<{ dep_iata: string; arr_iata: string; flights: number; upstream_total: number | null; pages: number; source_date: string | null; searches: number; fetched_at: Date; last_search_at: Date | null }>(
    "SELECT dep_iata, arr_iata, flights, upstream_total, pages, DATE_FORMAT(source_date, '%Y-%m-%d') source_date, searches, fetched_at, last_search_at FROM flight_routes ORDER BY last_search_at DESC, fetched_at DESC LIMIT 200",
  );
}
