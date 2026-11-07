"use client";

/** The traveller's last flight search, kept only in this browser (no personal data). */
const KEY = "skyo.recent.flight.v1";
export type RecentFlight = { fromLabel: string; toLabel: string; date: string; cabin: "economy" | "business"; adults: number; children?: number; infants?: number; at?: number };

export function saveRecentFlightSearch(s: RecentFlight) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {}
}
export function readRecentFlightSearch(): RecentFlight | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null") as RecentFlight | null;
    if (!r || !r.fromLabel || !r.toLabel || Date.now() - (r.at || 0) > 60 * 86400_000) return null;
    return r;
  } catch {
    return null;
  }
}
