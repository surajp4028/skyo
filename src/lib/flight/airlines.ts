/**
 * Airline brand data (colours for the logo badge, low-cost vs full-service, usual fleet)
 * and cabin seat layouts. aviationstack's free plan rarely returns the aircraft type,
 * so the seat map uses the airline's typical aircraft for the route length.
 */
export type AirlineInfo = { iata: string; name: string; short: string; color: string; ink: string; lcc: boolean; fleet: { short: AircraftCode; long: AircraftCode }; business: boolean };

const A = (iata: string, name: string, short: string, color: string, ink: string, lcc: boolean, short_: AircraftCode, long: AircraftCode, business = false): AirlineInfo => ({ iata, name, short, color, ink, lcc, fleet: { short: short_, long }, business });

export const AIRLINES: Record<string, AirlineInfo> = Object.fromEntries(
  [
    A("6E", "IndiGo", "IndiGo", "#1a1aa6", "#ffffff", true, "A320", "A321"),
    A("AI", "Air India", "Air India", "#d1202f", "#ffffff", false, "A320J", "A321J", true),
    A("IX", "Air India Express", "AI Express", "#e5631b", "#ffffff", true, "B738", "B738"),
    A("QP", "Akasa Air", "Akasa", "#ff6a13", "#ffffff", true, "B738", "B738"),
    A("SG", "SpiceJet", "SpiceJet", "#e21b23", "#ffffff", true, "B738", "B738"),
    A("9I", "Alliance Air", "Alliance", "#0b4ea2", "#ffffff", false, "AT72", "AT72"),
    A("UK", "Vistara", "Vistara", "#5f2167", "#ffffff", false, "A320J", "A321J", true),
    A("S5", "Star Air", "Star Air", "#0d2c54", "#ffffff", true, "E175", "E175"),
    A("2T", "TruJet", "TruJet", "#f7a600", "#0a0f1f", true, "AT72", "AT72"),
    A("EK", "Emirates", "Emirates", "#d71921", "#ffffff", false, "B77W", "B77W", true),
    A("QR", "Qatar Airways", "Qatar", "#5c0632", "#ffffff", false, "B788", "B788", true),
    A("EY", "Etihad Airways", "Etihad", "#bd8b13", "#ffffff", false, "B788", "B788", true),
    A("SQ", "Singapore Airlines", "Singapore", "#13235b", "#f4b400", false, "B788", "B788", true),
    A("TG", "Thai Airways", "Thai", "#5c2d91", "#ffffff", false, "B788", "B788", true),
    A("LH", "Lufthansa", "Lufthansa", "#05164d", "#f9ba00", false, "B788", "B788", true),
    A("BA", "British Airways", "British", "#075aaa", "#ffffff", false, "B788", "B788", true),
    A("UL", "SriLankan Airlines", "SriLankan", "#0f2a5f", "#ffffff", false, "A320J", "A321J", true),
    A("FZ", "flydubai", "flydubai", "#00a3e0", "#ffffff", true, "B738", "B738"),
    A("G9", "Air Arabia", "Air Arabia", "#e2231a", "#ffffff", true, "A320", "A320"),
    A("WY", "Oman Air", "Oman Air", "#8a6d3b", "#ffffff", false, "B738", "B788", true),
    A("TK", "Turkish Airlines", "Turkish", "#c70a0c", "#ffffff", false, "B77W", "B77W", true),
  ].map((a) => [a.iata, a]),
);

const PALETTE = ["#0f766e", "#7c3aed", "#0369a1", "#b45309", "#be123c", "#4338ca"];
/** Brand for any carrier — unknown ones get a stable colour from their code. */
export function airlineInfo(iata: string, name?: string | null): AirlineInfo {
  const k = (iata || "").toUpperCase();
  if (AIRLINES[k]) return AIRLINES[k];
  const color = PALETTE[[...k].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  return { iata: k, name: name || k, short: (name || k).split(" ")[0], color, ink: "#ffffff", lcc: false, fleet: { short: "A320", long: "A321" }, business: false };
}

/* ------------------------------- seat maps ------------------------------- */

export type AircraftCode = "A320" | "A321" | "A320J" | "A321J" | "B738" | "AT72" | "E175" | "B788" | "B77W";
export type CabinKey = "economy" | "business";
/** groups = seat letters per block between aisles, e.g. [["A","B","C"],["D","E","F"]]. */
export type CabinLayout = { cabin: CabinKey; fromRow: number; toRow: number; groups: string[][]; exitRows?: number[]; xlRows?: number[]; skipRows?: number[] };
export type AircraftLayout = { code: AircraftCode; name: string; cabins: CabinLayout[]; wide: boolean };

const ECO3 = [["A", "B", "C"], ["D", "E", "F"]];
export const AIRCRAFT: Record<AircraftCode, AircraftLayout> = {
  A320: { code: "A320", name: "Airbus A320neo", wide: false, cabins: [{ cabin: "economy", fromRow: 1, toRow: 31, groups: ECO3, exitRows: [12, 13], xlRows: [1], skipRows: [] }] },
  A321: { code: "A321", name: "Airbus A321neo", wide: false, cabins: [{ cabin: "economy", fromRow: 1, toRow: 38, groups: ECO3, exitRows: [11, 12, 25], xlRows: [1] }] },
  A320J: {
    code: "A320J", name: "Airbus A320neo", wide: false,
    cabins: [
      { cabin: "business", fromRow: 1, toRow: 2, groups: [["A", "C"], ["D", "F"]] },
      { cabin: "economy", fromRow: 3, toRow: 28, groups: ECO3, exitRows: [12, 13], xlRows: [3] },
    ],
  },
  A321J: {
    code: "A321J", name: "Airbus A321neo", wide: false,
    cabins: [
      { cabin: "business", fromRow: 1, toRow: 3, groups: [["A", "C"], ["D", "F"]] },
      { cabin: "economy", fromRow: 4, toRow: 35, groups: ECO3, exitRows: [11, 12, 24], xlRows: [4] },
    ],
  },
  B738: { code: "B738", name: "Boeing 737-8", wide: false, cabins: [{ cabin: "economy", fromRow: 1, toRow: 32, groups: ECO3, exitRows: [14, 15], xlRows: [1] }] },
  AT72: { code: "AT72", name: "ATR 72-600", wide: false, cabins: [{ cabin: "economy", fromRow: 1, toRow: 18, groups: [["A", "C"], ["D", "F"]], xlRows: [1] }] },
  E175: { code: "E175", name: "Embraer E175", wide: false, cabins: [{ cabin: "economy", fromRow: 1, toRow: 19, groups: [["A", "C"], ["D", "F"]], xlRows: [1] }] },
  B788: {
    code: "B788", name: "Boeing 787-8 Dreamliner", wide: true,
    cabins: [
      { cabin: "business", fromRow: 1, toRow: 5, groups: [["A"], ["D", "G"], ["K"]] },
      { cabin: "economy", fromRow: 10, toRow: 36, groups: [["A", "B", "C"], ["D", "E", "F"], ["G", "H", "K"]], exitRows: [10, 26], xlRows: [10] },
    ],
  },
  B77W: {
    code: "B77W", name: "Boeing 777-300ER", wide: true,
    cabins: [
      { cabin: "business", fromRow: 1, toRow: 7, groups: [["A"], ["D", "G"], ["K"]] },
      { cabin: "economy", fromRow: 20, toRow: 50, groups: [["A", "B", "C"], ["D", "E", "F", "G"], ["H", "J", "K"]], exitRows: [20, 35], xlRows: [20] },
    ],
  },
};

/** Aircraft for this flight: the airline's short- or long-haul type (aviationstack's icao code when known). */
export function aircraftFor(airline: string, distanceKm: number, icao?: string | null): AircraftLayout {
  const known: Record<string, AircraftCode> = { A20N: "A320", A320: "A320", A21N: "A321", A321: "A321", B738: "B738", B38M: "B738", B737: "B738", AT72: "AT72", AT76: "AT72", E75L: "E175", B788: "B788", B789: "B788", B77W: "B77W" };
  const info = airlineInfo(airline);
  let code = (icao && known[icao.toUpperCase()]) || (distanceKm > 1400 ? info.fleet.long : info.fleet.short);
  // full-service narrow-bodies carry a business cabin
  if (info.business && (code === "A320" || code === "A321")) code = code === "A320" ? "A320J" : "A321J";
  return AIRCRAFT[code];
}

export const cabinsOf = (l: AircraftLayout): CabinKey[] => [...new Set(l.cabins.map((c) => c.cabin))];
export const CABIN_LABEL: Record<CabinKey, string> = { economy: "Economy", business: "Business" };

export type SeatKind = "window" | "aisle" | "middle";
/** Window / aisle / middle for a seat letter inside its cabin. */
export function seatKind(c: CabinLayout, letter: string): SeatKind {
  const gi = c.groups.findIndex((g) => g.includes(letter));
  if (gi < 0) return "middle";
  const g = c.groups[gi];
  const i = g.indexOf(letter);
  const first = gi === 0;
  const last = gi === c.groups.length - 1;
  if ((first && i === 0) || (last && i === g.length - 1)) return "window";
  if ((!first && i === 0) || (!last && i === g.length - 1)) return "aisle";
  return "middle";
}

/** Every seat id ("12A") in a cabin, row by row. */
export function seatsOf(c: CabinLayout): string[] {
  const out: string[] = [];
  for (let r = c.fromRow; r <= c.toRow; r++) {
    if (c.skipRows?.includes(r)) continue;
    for (const g of c.groups) for (const l of g) out.push(`${r}${l}`);
  }
  return out;
}

export const parseSeat = (s: string) => {
  const m = s.match(/^(\d{1,2})([A-K])$/);
  return m ? { row: Number(m[1]), letter: m[2] } : null;
};
