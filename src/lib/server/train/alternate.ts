import "server-only";
import { ApiError } from "../http";
import { getSetting } from "../settings";
import { seatAvailabilityBatch, trainStops } from "./service";
import type { RailResult } from "./client";
import type { AvailabilityDetail, ClassCode, Quota, ScheduleStop } from "./types";

/*
 * "Alternate seat" — for the waitlisted classes of ONE train, look for a better way onto the same train:
 *   1. Book from an earlier station (upstream quota), board at your own station.
 *   2. Change seat on the way: two tickets split at a major stop.
 * Plus the traveller's own route, which gives the real % chance for each class (the search list only has a label).
 * One train = ONE route lookup + ONE batch call for all its classes (RailCore allows ~20 requests a minute, so
 * one-call-per-class got throttled). Batch cost = max(5, 2 × station pairs × classes).
 */
export type AltLeg = { from: string; fromName: string; to: string; toName: string; date: string; dep: string | null; arr: string | null; status: string; text: string; fare: number | null; chance: number | null };
/** "confirmed" = seats available now; "likely" = waitlisted but RailCore predicts ≥ `train_alt_min_chance` % to confirm. */
export type AltLevel = "confirmed" | "likely";
export type AlternateSeats = {
  train: string; cls: ClassCode; checked: number;
  bookFrom: (AltLeg & { boardAt: string; boardAtName: string; level: AltLevel })[];
  split: { via: string; viaName: string; viaTime: string | null; legs: [AltLeg, AltLeg]; total: number | null; level: AltLevel; chance: number | null }[];
  tried: { kind: "from" | "split"; station: string; status: string }[];
  /** the traveller's own route for this class, with RailCore's real confirmation % */
  own?: AltLeg;
};
export type AlternateSeatsByClass = { train: string; classes: Partial<Record<ClassCode, AlternateSeats>> };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const chanceOf = (a?: AvailabilityDetail) => (a?.status === "AVAILABLE" ? 100 : a?.confirmation_probability?.percentage ?? null);

export async function findAlternateSeats(p: { train: string; from: string; to: string; date: string; classes: ClassCode[]; quota: Quota; userId: number | null }): Promise<RailResult<AlternateSeatsByClass>> {
  if ((await getSetting("train_alt_seats")) !== "on") throw new ApiError(404, "SERVICE_OFF", "Alternate seats aren't available right now.");
  const max = Math.min(10, Math.max(2, parseInt(await getSetting("train_alt_max_checks"), 10) || 6));
  const minChance = Math.min(100, Math.max(50, parseInt(await getSetting("train_alt_min_chance"), 10) || 85));
  const classes = [...new Set(p.classes)].slice(0, 8);

  const route = await trainStops(p.train, { userId: p.userId });
  const stops = (route.data.stops || []).filter((s) => s.is_stop);
  const iF = stops.findIndex((s) => s.station_code === p.from);
  const iT = stops.findIndex((s) => s.station_code === p.to);
  if (iF < 0 || iT < 0 || iT <= iF) throw new ApiError(422, "ROUTE", "This train doesn't stop at both of your stations.");
  const at = (s: ScheduleStop) => addDays(p.date, s.day - stops[iF].day); // train date at that station
  const halt = (s: ScheduleStop) => s.halt_minutes ?? 0;

  // upstream: the train's origin + the busiest stops before you (bigger stations carry their own quota)
  const up = stops.slice(0, iF);
  const upPick = [...new Set([up[0], ...[...up.slice(1)].sort((a, b) => halt(b) - halt(a)).slice(0, 2)].filter(Boolean))] as ScheduleStop[];
  // split points: the biggest junctions between your stations, nearer the middle first on ties
  const mid = stops.slice(iF + 1, iT);
  const centre = (iF + iT) / 2;
  const midPick = [...mid].sort((a, b) => halt(b) - halt(a) || Math.abs(stops.indexOf(a) - centre) - Math.abs(stops.indexOf(b) - centre));

  // station budget: one per "book from" station, two per split point (same stations for every class)
  const fromStations: ScheduleStop[] = [];
  const splitStations: ScheduleStop[] = [];
  let budget = max;
  for (const s of upPick) {
    if (budget < 1 || fromStations.length >= 2) break;
    fromStations.push(s);
    budget -= 1;
  }
  for (const s of midPick) {
    if (budget < 2 || splitStations.length >= 3) break;
    splitStations.push(s);
    budget -= 2;
  }

  type Item = { train_number: string; from: string; to: string; date: string; classes: ClassCode[]; quota: Quota };
  const items: Item[] = [];
  const key = (f: string, t: string) => `${f}>${t}`;
  const add = (f: string, t: string, d: string) => {
    if (!items.some((i) => i.from === f && i.to === t)) items.push({ train_number: p.train, from: f, to: t, date: d, classes, quota: p.quota });
  };
  add(p.from, p.to, p.date); // own route → real % chance per class
  for (const s of fromStations) add(s.station_code, p.to, at(s));
  for (const s of splitStations) {
    add(p.from, s.station_code, p.date);
    add(s.station_code, p.to, at(s));
  }

  const batch = await seatAvailabilityBatch(items, { userId: p.userId });
  const res = new Map<string, AvailabilityDetail[]>();
  for (const r of batch.data.results || []) res.set(key(r.from_station_code, r.to_station_code), r.classes || []);
  const byCode = new Map(stops.map((s) => [s.station_code, s]));

  const out: AlternateSeatsByClass["classes"] = {};
  for (const cls of classes) {
    const leg = (f: string, t: string, d: string): AltLeg => {
      const a = res.get(key(f, t))?.find((c) => c.class_code === cls);
      return {
        from: f, fromName: byCode.get(f)?.station_name || f, to: t, toName: byCode.get(t)?.station_name || t, date: d,
        dep: byCode.get(f)?.departure_time ?? null, arr: byCode.get(t)?.arrival_time ?? null,
        status: a?.status || "UNKNOWN", text: a?.availability_text || "—", fare: a?.total_fare ?? a?.fare ?? null, chance: chanceOf(a),
      };
    };
    const tried: AlternateSeats["tried"] = [];
    const bookFrom: AlternateSeats["bookFrom"] = [];
    for (const s of fromStations) {
      const l = leg(s.station_code, p.to, at(s));
      tried.push({ kind: "from", station: s.station_code, status: l.status });
      if (l.status === "AVAILABLE") bookFrom.push({ ...l, boardAt: p.from, boardAtName: stops[iF].station_name, level: "confirmed" });
      else if ((l.chance ?? 0) >= minChance) bookFrom.push({ ...l, boardAt: p.from, boardAtName: stops[iF].station_name, level: "likely" });
    }
    const split: AlternateSeats["split"] = [];
    for (const s of splitStations) {
      const a = leg(p.from, s.station_code, p.date);
      const b = leg(s.station_code, p.to, at(s));
      tried.push({ kind: "split", station: s.station_code, status: `${a.status}/${b.status}` });
      const total = a.fare != null && b.fare != null ? a.fare + b.fare : null;
      const both = Math.min(a.chance ?? 0, b.chance ?? 0); // the weaker leg decides
      if (a.status === "AVAILABLE" && b.status === "AVAILABLE") split.push({ via: s.station_code, viaName: s.station_name, viaTime: s.arrival_time, legs: [a, b], total, level: "confirmed", chance: 100 });
      else if (both >= minChance) split.push({ via: s.station_code, viaName: s.station_name, viaTime: s.arrival_time, legs: [a, b], total, level: "likely", chance: both });
    }
    const rank = (x: { level: AltLevel; chance?: number | null }) => (x.level === "confirmed" ? 1000 : x.chance ?? 0);
    bookFrom.sort((a, b) => rank(b) - rank(a));
    split.sort((a, b) => rank(b) - rank(a));
    out[cls] = { train: p.train, cls, checked: items.length - 1, bookFrom, split, tried, own: leg(p.from, p.to, p.date) };
  }
  return {
    data: { train: p.train, classes: out },
    meta: batch.meta,
    credits: { cost: route.credits.cost + batch.credits.cost, remaining: batch.credits.remaining },
  };
}
