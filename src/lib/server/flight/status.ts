import "server-only";
import { exec, queryOne, sqlDate } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getSetting } from "../settings";
import { aviation, type AsFlight } from "./aviationstack";
import { worldAirport as airportByCode } from "./world-airports";
import { airlineInfo } from "@/lib/flight/airlines";
import { todayIST } from "@/lib/flight/model";

export type LiveFlight = {
  flight: string; date: string; status: string; airline: { iata: string; name: string };
  dep: { iata: string; airport: string; city: string; terminal: string | null; gate: string | null; scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null; lat: number | null; lon: number | null };
  arr: { iata: string; airport: string; city: string; terminal: string | null; gate: string | null; baggage: string | null; scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null; lat: number | null; lon: number | null };
  live: { lat: number; lon: number; altitude: number; speed: number; direction: number; isGround: boolean; updated: string } | null;
  aircraft: { registration: string | null; icao: string | null } | null;
  fetchedAt: string; cached: boolean;
};

/** "2026-11-07T23:50:00+00:00" → "23:50" (aviationstack's local airport time). */
const t = (s: string | null | undefined) => (s && s.length >= 16 ? s.slice(11, 16) : null);

function shape(r: AsFlight, flight: string, fetchedAt: string, cached: boolean): LiveFlight {
  const d = airportByCode(r.departure.iata);
  const a = airportByCode(r.arrival.iata);
  return {
    flight, date: r.flight_date, status: r.flight_status || "scheduled",
    airline: { iata: r.airline.iata || flight.slice(0, 2), name: airlineInfo(r.airline.iata || "", r.airline.name).name },
    dep: { iata: r.departure.iata || "", airport: d?.name || r.departure.airport || "", city: d?.city || r.departure.airport || "", terminal: r.departure.terminal, gate: r.departure.gate, scheduled: t(r.departure.scheduled), estimated: t(r.departure.estimated), actual: t(r.departure.actual), delay: r.departure.delay, lat: d?.lat ?? null, lon: d?.lon ?? null },
    arr: { iata: r.arrival.iata || "", airport: a?.name || r.arrival.airport || "", city: a?.city || r.arrival.airport || "", terminal: r.arrival.terminal, gate: r.arrival.gate, baggage: r.arrival.baggage, scheduled: t(r.arrival.scheduled), estimated: t(r.arrival.estimated), actual: t(r.arrival.actual), delay: r.arrival.delay, lat: a?.lat ?? null, lon: a?.lon ?? null },
    live: r.live ? { lat: r.live.latitude, lon: r.live.longitude, altitude: Math.round(r.live.altitude), speed: Math.round(r.live.speed_horizontal), direction: Math.round(r.live.direction), isGround: r.live.is_ground, updated: r.live.updated } : null,
    aircraft: r.aircraft ? { registration: r.aircraft.registration, icao: r.aircraft.icao } : null,
    fetchedAt, cached,
  };
}

/**
 * Live status of one flight TODAY (free plan = real-time only). Cached per flight for
 * `flight_live_cache_min` so a page refresh never spends a second request.
 */
export async function liveStatus(flight: string, userId: number | null, reason = "track"): Promise<LiveFlight> {
  if ((await getSetting("flight_live")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Live flight tracking is not available.");
  const code = flight.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(code)) throw new ApiError(422, "BAD_FLIGHT", "Enter a flight number like 6E 622.");
  const date = todayIST();
  const ttl = Math.max(5, parseInt(await getSetting("flight_live_cache_min"), 10) || 15);
  const c = await queryOne<{ data_enc: string; fetched_at: Date }>("SELECT data_enc, fetched_at FROM flight_status_cache WHERE flight_iata = ? AND flight_date = ?", [code, date]);
  if (c && Date.now() - new Date(c.fetched_at).getTime() < ttl * 60_000) {
    return shape(JSON.parse(await decrypt(c.data_enc)) as AsFlight, code, new Date(c.fetched_at).toISOString(), true);
  }
  const r = await aviation<AsFlight>("flights", { flight_iata: code, limit: 10 }, { reason, userId });
  // prefer today's operating row, else the latest one
  const rows = r.data.filter((x) => !x.flight.codeshared);
  const pick = rows.find((x) => x.flight_date === date) || rows.sort((x, y) => (y.flight_date || "").localeCompare(x.flight_date || ""))[0] || r.data[0];
  if (!pick) throw new ApiError(404, "FLIGHT_NOT_FOUND", `No flight ${code} is operating today.`);
  await exec(
    "INSERT INTO flight_status_cache (flight_iata, flight_date, data_enc, fetched_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data_enc = VALUES(data_enc), fetched_at = VALUES(fetched_at)",
    [code, date, await encrypt(JSON.stringify(pick)), sqlDate()],
  );
  return shape(pick, code, new Date().toISOString(), false);
}
