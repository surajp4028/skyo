import "server-only";
import { exec, queryOne, sqlDate } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getSetting } from "../settings";
import { aviation, type AsFlight } from "./aviationstack";
import { worldAirport } from "./world-airports";
import { airlineInfo } from "@/lib/flight/airlines";

/*
 * Airport live board — today's departures or arrivals at one airport, from aviationstack's real-time
 * /v1/flights?dep_iata=XXX (or arr_iata) — available on the FREE plan. One request per airport + direction,
 * cached for `flight_board_cache_min` (default 30) so everyone looking at DEL departures shares it.
 * Codeshare rows are folded into the operating flight (shown as "also XX123").
 */
export type BoardRow = {
  flight: string; airline: { iata: string; name: string }; codeshares: string[];
  other: { iata: string; city: string };
  scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null;
  terminal: string | null; gate: string | null; baggage: string | null;
  status: string;
};
export type Board = { airport: { iata: string; city: string; name: string }; type: "departure" | "arrival"; rows: BoardRow[]; fetchedAt: string; cached: boolean; total: number | null };

const hm = (s: string | null | undefined) => (s && s.length >= 16 ? s.slice(11, 16) : null);

function shape(rows: AsFlight[], type: "departure" | "arrival"): BoardRow[] {
  const ops = new Map<string, BoardRow>();
  const cs = new Map<string, string[]>();
  for (const r of rows) {
    const code = r.flight.codeshared ? (r.flight.codeshared.flight_iata || "").toUpperCase() : (r.flight.iata || "").toUpperCase();
    if (!code) continue;
    if (r.flight.codeshared) {
      cs.set(code, [...(cs.get(code) || []), (r.flight.iata || "").toUpperCase()].filter(Boolean));
      if (ops.has(code)) continue;
    } else if (ops.has(code) && !ops.get(code)!.codeshares.length) {
      // operating row arrived after a codeshare placeholder — replace it below
    }
    const mine = type === "departure" ? r.departure : r.arrival;
    const other = type === "departure" ? r.arrival : r.departure;
    const oa = worldAirport(other.iata);
    const ai = (r.flight.codeshared ? r.flight.codeshared.airline_iata : r.airline.iata) || code.slice(0, 2);
    ops.set(code, {
      flight: `${code.slice(0, 2)} ${code.slice(2)}`,
      airline: { iata: ai.toUpperCase(), name: airlineInfo(ai.toUpperCase(), r.flight.codeshared ? r.flight.codeshared.airline_name : r.airline.name).name },
      codeshares: [],
      other: { iata: (other.iata || "").toUpperCase(), city: oa?.city || other.airport || other.iata || "" },
      scheduled: hm(mine.scheduled), estimated: hm(mine.estimated), actual: hm(mine.actual), delay: mine.delay ?? null,
      terminal: mine.terminal, gate: mine.gate, baggage: type === "arrival" ? r.arrival.baggage : null,
      status: r.flight_status || "scheduled",
    });
  }
  for (const [k, v] of ops) v.codeshares = [...new Set(cs.get(k) || [])].slice(0, 4);
  return [...ops.values()].sort((a, b) => (a.scheduled || "").localeCompare(b.scheduled || ""));
}

export async function airportBoard(code: string, type: "departure" | "arrival", opts: { allowFetch: boolean | (() => Promise<boolean>); userId: number | null }): Promise<Board> {
  if ((await getSetting("flight_airport_board")) !== "on") throw new ApiError(404, "SERVICE_OFF", "The airport board isn't available.");
  const ap = worldAirport(code);
  if (!ap) throw new ApiError(404, "AIRPORT", "We couldn't find that airport.");
  const ttl = Math.max(10, parseInt(await getSetting("flight_board_cache_min"), 10) || 30);
  const c = await queryOne<{ data_enc: string; fetched_at: Date }>("SELECT data_enc, fetched_at FROM flight_board_cache WHERE airport_iata = ? AND board_type = ?", [ap.iata, type]);
  const fresh = c && Date.now() - new Date(c.fetched_at).getTime() < ttl * 60_000;
  const base = { airport: { iata: ap.iata, city: ap.city, name: ap.name }, type };
  const cachedBoard = async () => {
    const d = JSON.parse(await decrypt(c!.data_enc)) as { rows: BoardRow[]; total: number | null };
    return { ...base, rows: d.rows, total: d.total, fetchedAt: new Date(c!.fetched_at).toISOString(), cached: true } satisfies Board;
  };
  if (c && fresh) return cachedBoard();
  // only now (a request would be spent) ask whether this visitor may refresh
  const may = typeof opts.allowFetch === "function" ? await opts.allowFetch() : opts.allowFetch;
  if (!may) {
    if (c) return cachedBoard(); // slightly old board beats nothing
    throw new ApiError(opts.userId ? 429 : 401, opts.userId ? "BOARD_LIMIT" : "LOGIN_REQUIRED", opts.userId ? "You've opened several airport boards today. Try again tomorrow." : "Log in to load this airport's live board.");
  }
  const r = await aviation<AsFlight>("flights", { [type === "departure" ? "dep_iata" : "arr_iata"]: ap.iata, limit: 100 }, { reason: "board", userId: opts.userId });
  const rows = shape(r.data, type);
  const total = r.pagination?.total ?? null;
  await exec(
    "INSERT INTO flight_board_cache (airport_iata, board_type, data_enc, fetched_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data_enc = VALUES(data_enc), fetched_at = VALUES(fetched_at)",
    [ap.iata, type, await encrypt(JSON.stringify({ rows, total })), sqlDate()],
  );
  return { ...base, rows, total, fetchedAt: new Date().toISOString(), cached: false };
}
