import "server-only";
import data from "./stations-india.json";

/**
 * All-India station index (≈ 9,000 stations) for zero-credit autocomplete.
 * Source: datameet/railways stations.json (CC0 public domain), merged with SKYO's curated
 * list of major stations (current names such as Prayagraj Jn, Rani Kamlapati, SMVT Bengaluru).
 */
type Row = { c: string; n: string; s: string; city?: string; major?: number };
export type StationHit = { code: string; name: string; city: string; source: "local" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const rows = (data as Row[]).map((r) => ({ ...r, nn: norm(r.n), nc: norm(r.city || ""), lc: r.c.toLowerCase() }));

export function searchAllStations(q: string, limit = 10): StationHit[] {
  const n = norm(q);
  if (!n) return [];
  const scored: { r: (typeof rows)[number]; s: number }[] = [];
  for (const r of rows) {
    let s = 0;
    if (r.lc === n) s = 100;
    else if (r.lc.startsWith(n) && n.length >= 2) s = 70;
    else if (r.nn.startsWith(n) || r.nc.startsWith(n)) s = 80;
    else if (r.nn.split(" ").some((w) => w.startsWith(n))) s = 55;
    else if (n.length >= 3 && r.nn.includes(n)) s = 35;
    if (!s) continue;
    if (r.major) s += 15;
    scored.push({ r, s });
  }
  scored.sort((a, b) => b.s - a.s || a.r.n.length - b.r.n.length);
  return scored.slice(0, limit).map(({ r }) => ({ code: r.c, name: r.n, city: r.city || r.s || "", source: "local" }));
}
