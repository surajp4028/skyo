"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { useAuth } from "./providers";
import type { PnrResponse, SavedPnr } from "@/lib/train/pnr-types";

/*
 * "Your PNRs" — one list shared by every component on the page (home section, /trains/pnr).
 *   guest     → kept in this browser (localStorage), last status included
 *   logged in → kept in the account (DB, encrypted); anything saved in this browser is moved there once
 * Reading the list never calls RailKit. Only Refresh / Check does, through POST /api/train/pnr.
 */
const KEY = "skyo:pnr:saved";
const OLD_KEY = "skyo:pnr:recent";
const MAX = 10;

type State = { items: SavedPnr[]; ready: boolean; mode: "local" | "account" };
let state: State = { items: [], ready: false, mode: "local" };
let loadedFor: string | null = null; // "guest" | "u:<id>"
const subs = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};

function readLocal(): SavedPnr[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    const list: SavedPnr[] = Array.isArray(v) ? v.filter((x) => x && typeof x.pnr === "string" && /^\d{10}$/.test(x.pnr)) : [];
    // numbers saved by the first version of the PNR page
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || "[]");
    if (Array.isArray(old)) for (const p of old) if (typeof p === "string" && /^\d{10}$/.test(p) && !list.some((x) => x.pnr === p)) list.push({ pnr: p, data: null, fetchedAt: null, nextRefreshAt: null });
    return list.slice(0, MAX);
  } catch {
    return [];
  }
}
function writeLocal(items: SavedPnr[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    localStorage.removeItem(OLD_KEY);
  } catch {}
}
function clearLocal() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {}
}

async function load(userId: string | null) {
  const who = userId ? `u:${userId}` : "guest";
  if (loadedFor === who) return;
  loadedFor = who;
  if (!userId) {
    set({ items: readLocal(), ready: true, mode: "local" });
    return;
  }
  try {
    const local = readLocal();
    const r = local.length
      ? await api<{ pnrs: SavedPnr[] }>("/api/account/pnrs", { body: { pnrs: local.map((x) => x.pnr) } })
      : await api<{ pnrs: SavedPnr[] }>("/api/account/pnrs", { method: "GET" });
    if (local.length) clearLocal();
    // a freshly imported PNR has no status on the server yet — keep the one this browser had
    const items = r.pnrs.map((s) => (s.data ? s : local.find((l) => l.pnr === s.pnr && l.data) || s));
    set({ items, ready: true, mode: "account" });
  } catch {
    // account list didn't load (network / server restarting) — show what this browser has and retry on the next visit or focus
    loadedFor = null;
    set({ items: readLocal(), ready: true, mode: "local" });
  }
}

/** Put a fresh lookup at the top of the list. */
export function recordPnr(r: PnrResponse) {
  const item: SavedPnr = { pnr: r.data.pnr, data: r.data, fetchedAt: r.fetchedAt, nextRefreshAt: r.nextRefreshAt };
  const items = [item, ...state.items.filter((x) => x.pnr !== item.pnr)].slice(0, MAX);
  set({ items });
  if (state.mode === "local") writeLocal(items); // logged in: the server saved it already
}

/** Re-check one saved PNR (the server still answers from cache until it's due). */
export async function refreshPnr(pnr: string) {
  const r = await api<PnrResponse>("/api/train/pnr", { body: { pnr, refresh: true } });
  recordPnr(r);
  return r;
}

export async function removePnr(pnr: string) {
  const before = state.items;
  const items = before.filter((x) => x.pnr !== pnr);
  set({ items });
  if (state.mode === "local") return writeLocal(items);
  try {
    await api("/api/account/pnrs", { method: "DELETE", body: { pnr } });
  } catch (e) {
    set({ items: before });
    throw e;
  }
}

const EMPTY: State = { items: [], ready: false, mode: "local" };
export function useSavedPnrs() {
  const { user, ready } = useAuth();
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    if (!ready) return;
    const uid = user?.uid ?? null;
    void load(uid);
    const retry = () => {
      if (loadedFor === null) void load(uid);
    };
    window.addEventListener("focus", retry);
    return () => window.removeEventListener("focus", retry);
  }, [ready, user?.uid]);
  return { ...s, loggedIn: !!user };
}
