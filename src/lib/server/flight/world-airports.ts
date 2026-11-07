import "server-only";
import { AIRPORTS, airportByCode, type Airport } from "@/lib/flight/airports";
import rows from "./airports-world.json";

/*
 * Every airport with an IATA code worldwide (~7,900) from the open mwgg/Airports dataset (MIT),
 * stored compactly on the server. SKYO's curated list (Indian + major hubs, with friendlier names)
 * always wins; this fills in everything else — Ulaanbaatar, Reykjavík, small regional fields…
 * Searching never costs an aviationstack request.
 */
type Row = [string, string, string, string, string, number, number, string];

const regionName = (() => {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (cc: string) => {
      try {
        return dn.of(cc) || cc;
      } catch {
        return cc;
      }
    };
  } catch {
    return (cc: string) => cc;
  }
})();

const tidyName = (n: string) => n.replace(/\s+Airport$/i, "").replace(/\s+/g, " ").trim();

let index: { list: Airport[]; byCode: Map<string, Airport>; country: Map<string, string> } | null = null;
function load() {
  if (index) return index;
  const byCode = new Map<string, Airport>();
  for (const a of AIRPORTS) byCode.set(a.iata, a);
  for (const [iata, name, city, state, cc, lat, lon, tz] of rows as Row[]) {
    if (byCode.has(iata)) continue;
    byCode.set(iata, { iata, name: tidyName(name) || iata, city: city || tidyName(name) || iata, state, country: cc || "", lat, lon, tz: tz || "UTC" });
  }
  const country = new Map<string, string>();
  for (const a of byCode.values()) if (a.country && !country.has(a.country)) country.set(a.country, regionName(a.country).toLowerCase());
  index = { list: [...byCode.values()], byCode, country };
  return index;
}

/** Any airport by IATA code (curated first, then the world list). */
export function worldAirport(code?: string | null): Airport | null {
  if (!code) return null;
  return airportByCode(code) ?? load().byCode.get(code.toUpperCase()) ?? null;
}
export const isWorldAirport = (code: string) => !!worldAirport(code);
export const countryName = (cc: string) => regionName(cc);

const CURATED = new Set(AIRPORTS.map((a) => a.iata));

/**
 * Ranked search by code, city, airport name, state or COUNTRY ("mongolia" → Ulaanbaatar…).
 * Curated / international airports rank above small fields on ties.
 */
export function searchWorldAirports(q: string, limit = 12): (Airport & { countryName: string })[] {
  const { list, country } = load();
  const s = q.replace(/\s*\([A-Z]{3}\)\s*$/i, "").trim().toLowerCase();
  if (!s) return AIRPORTS.filter((a) => a.metro).slice(0, limit).map((a) => ({ ...a, countryName: regionName(a.country) }));
  const scored: [Airport, number][] = [];
  for (const a of list) {
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    const cn = country.get(a.country) || "";
    let sc = 99;
    if (a.iata.toLowerCase() === s) sc = 0;
    else if (city === s) sc = 1;
    else if (city.startsWith(s)) sc = 2;
    else if (name.startsWith(s)) sc = 3;
    else if (cn.startsWith(s) || a.country.toLowerCase() === s) sc = 4;
    else if (city.includes(s) || name.includes(s)) sc = 5;
    else if (a.state.toLowerCase().startsWith(s)) sc = 6;
    if (sc === 99) continue;
    // tie-breakers: SKYO's curated airports, "International", Indian airports
    sc += (CURATED.has(a.iata) ? 0 : 0.4) + (/international/i.test(a.name) ? 0 : 0.2) + (a.country === "IN" ? 0 : 0.1);
    scored.push([a, sc]);
  }
  return scored
    .sort((x, y) => x[1] - y[1] || x[0].city.localeCompare(y[0].city))
    .slice(0, limit)
    .map(([a]) => ({ ...a, countryName: regionName(a.country) }));
}
