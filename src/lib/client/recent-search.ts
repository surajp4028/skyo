"use client";

/** The traveller's last train search, kept in this browser only (no personal data — station names, date, quota). */
export type RecentTrainSearch = { fromLabel: string; toLabel: string; date: string; quota: string; at: number };
const KEY = "skyo.recent.train.v1";

export function saveRecentTrainSearch(s: Omit<RecentTrainSearch, "at">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {}
}

export function readRecentTrainSearch(): RecentTrainSearch | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as RecentTrainSearch | null;
    if (!v || typeof v.fromLabel !== "string" || typeof v.toLabel !== "string") return null;
    if (Date.now() - v.at > 60 * 86400_000) return null; // forget after 60 days
    return v;
  } catch {
    return null;
  }
}
