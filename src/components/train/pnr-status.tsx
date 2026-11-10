"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CalendarDays, Clock3, Loader2, Radio, RefreshCw, Search, Ticket, TrainFront, Users } from "lucide-react";
import { api, ClientApiError } from "@/lib/client/api";
import { recordPnr } from "@/lib/client/pnr-store";
import { groupPnr, statusTone, type PnrResponse } from "@/lib/train/pnr-types";
import { SavedPnrs } from "./saved-pnrs";
import { useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";
import { cn } from "@/lib/utils";

type Res = PnrResponse;

const CLASS: Record<string, string> = { "1A": "First AC", "2A": "AC 2 Tier", "3A": "AC 3 Tier", "3E": "AC 3 Economy", SL: "Sleeper", CC: "AC Chair Car", EC: "Executive Chair", "2S": "Second Sitting", EA: "Executive Anubhuti", FC: "First Class" };
const QUOTA: Record<string, string> = { GN: "General", TQ: "Tatkal", PT: "Premium Tatkal", LD: "Ladies", SS: "Senior Citizen", HP: "Divyaang", DF: "Defence", FT: "Foreign Tourist", YU: "Yuva" };
const BERTH: Record<string, string> = { LB: "Lower", MB: "Middle", UB: "Upper", SL: "Side lower", SU: "Side upper", WS: "Window", MS: "Middle", AS: "Aisle" };

const fmtWhen = (iso: string | null, text: string | null) => {
  if (!iso) return text || "—";
  const d = new Date(`${iso}:00+05:30`);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
};
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

export function PnrStatus() {
  const site = useSite();
  const [pnr, setPnr] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<{ msg: string; code: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const check = async (value: string, refresh = false) => {
    const digits = value.replace(/\D+/g, "");
    if (digits.length !== 10) {
      setErr({ msg: "A PNR has 10 digits — it's printed at the top left of your ticket.", code: "VALIDATION" });
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Res>("/api/train/pnr", { body: { pnr: digits, refresh } });
      setRes(r);
      setNow(Date.now());
      recordPnr(r);
    } catch (e) {
      setRes(null);
      setErr(e instanceof ClientApiError ? { msg: e.info.message, code: e.info.code } : { msg: "Something went wrong. Please try again.", code: "ERR" });
    } finally {
      setBusy(false);
    }
  };

  // deep link from My Trips / home (/trains/pnr#1234567890 — the hash never reaches a server)
  useEffect(() => {
    const fromHash = window.location.hash.replace(/\D+/g, "");
    const t = setTimeout(() => {
      if (fromHash.length === 10) {
        setPnr(fromHash);
        history.replaceState(null, "", window.location.pathname);
        void check(fromHash);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // keep "updated x min ago" / refresh button honest
  useEffect(() => {
    if (!res) return;
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, [res]);

  const canRefresh = !!res && now >= new Date(res.nextRefreshAt).getTime();
  return (
    <div className="mx-auto max-w-4xl">
      {/* search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check(pnr);
        }}
        className="flex flex-col gap-2 rounded-[26px] border border-white/70 bg-white/95 p-2 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.55)] backdrop-blur-xl sm:flex-row"
      >
        <label className="flex flex-1 items-center gap-3 rounded-[20px] bg-surface px-4 py-3 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-[#0057ff]/30">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-iris to-[#0057ff] text-white shadow-md"><Ticket className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">PNR number</span>
            <input
              ref={inputRef}
              value={groupPnr(pnr)}
              onChange={(e) => setPnr(e.target.value.replace(/\D+/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 482-1937605"
              aria-label="10-digit PNR number"
              className="w-full bg-transparent font-mono text-xl font-extrabold tracking-[0.12em] text-ink outline-none placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-ink/30"
            />
          </span>
          <span className={cn("hidden rounded-full px-2 py-0.5 font-mono text-[11px] font-bold sm:block", pnr.length === 10 ? "bg-emerald-50 text-emerald-700" : "bg-white text-muted")}>{pnr.length}/10</span>
        </label>
        <button disabled={busy} className="flex h-[66px] items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-brand to-brand-2 px-7 font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,90,31,0.8)] transition hover:brightness-110 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />} Check status
        </button>
      </form>

      <SavedPnrs
        tone="sky"
        activePnr={res?.data.pnr ?? null}
        className="mt-6"
        onOpen={(p) => {
          setPnr(p);
          void check(p);
        }}
      />

      <AnimatePresence mode="wait">
        {busy && !res && (
          <motion.div key="load" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 overflow-hidden rounded-[28px] bg-white p-6 shadow-lift">
            <div className="h-5 w-48 animate-pulse rounded bg-surface" />
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="h-12 animate-pulse rounded-xl bg-surface" />
              <TrainFront className="h-6 w-6 animate-bounce text-ink/20" />
              <div className="h-12 animate-pulse rounded-xl bg-surface" />
            </div>
            <div className="mt-6 space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />)}</div>
            <p className="mt-4 text-center text-xs font-semibold text-muted">Asking the railways for your PNR…</p>
          </motion.div>
        )}
        {err && !busy && (
          <motion.div key="err" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 rounded-[24px] bg-white p-6 text-center shadow-lift">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Ticket className="h-6 w-6" /></span>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-ink">{err.msg}</p>
            {(err.code === "LOGIN_REQUIRED" || err.code === "LOGIN_FOR_MORE") && (
              <Link href={`/login?next=${encodeURIComponent("/trains/pnr")}`} className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Log in</Link>
            )}
          </motion.div>
        )}
        {res && <Result key={res.data.pnr + res.fetchedAt} res={res} busy={busy} canRefresh={canRefresh} onRefresh={() => check(res.data.pnr, true)} liveOn={isTrainLiveOn(site)} />}
      </AnimatePresence>
    </div>
  );
}

function Result({ res, busy, canRefresh, onRefresh, liveOn }: { res: Res; busy: boolean; canRefresh: boolean; onRefresh: () => void; liveOn: boolean }) {
  const v = res.data;
  const j = v.journey;
  const counts = v.passengers.reduce(
    (a, p) => {
      const s = p.current.status.toUpperCase();
      if (s.startsWith("CNF")) a.cnf++;
      else if (s.startsWith("RAC")) a.rac++;
      else if (s.includes("WL")) a.wl++;
      else if (s.startsWith("CAN")) a.can++;
      return a;
    },
    { cnf: 0, rac: 0, wl: 0, can: 0 },
  );
  const total = v.passengers.length;
  const headline =
    total === 0 ? "No passenger details" : counts.cnf === total ? (total === 1 ? "Your seat is confirmed" : "Everyone is confirmed") : counts.can === total ? "This ticket is cancelled" : `${counts.cnf} of ${total} confirmed`;
  const boardingDiffers = j.boarding && j.from && j.boarding.code !== j.from.code;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="mt-6">
      {res.note && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"><Clock3 className="h-4 w-4 shrink-0" /> {res.note}</div>
      )}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_40px_90px_-40px_rgba(10,15,31,0.55)] ring-1 ring-line">
        {/* train band */}
        <div className="relative overflow-hidden bg-ink px-5 py-4 text-white md:px-7">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-40" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 shadow-lg"><TrainFront className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold tracking-widest text-white/60">PNR {groupPnr(v.pnr)}</div>
                <div className="truncate text-lg font-extrabold">{v.train.number} · {v.train.name || "Train"}</div>
              </div>
            </div>
            <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", v.chart.prepared ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-200")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", v.chart.prepared ? "bg-emerald-400" : "animate-pulse bg-amber-300")} /> {v.chart.text}
            </span>
          </div>
        </div>

        {/* route */}
        <div className="px-5 pb-5 pt-6 md:px-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 md:gap-6">
            <div>
              <div className="text-3xl font-black tracking-tight text-ink md:text-4xl">{j.from?.code || "—"}</div>
              <div className="truncate text-xs font-semibold text-muted md:text-sm">{j.from?.name}</div>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-ink md:text-sm"><CalendarDays className="h-3.5 w-3.5 text-brand" /> {fmtWhen(j.date, j.dateText)}</div>
            </div>
            <div className="flex w-20 flex-col items-center pt-3 sm:w-40 md:w-56">
              <div className="relative h-0.5 w-full rounded-full bg-line">
                <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-brand bg-white" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                <span className="route-runner absolute -top-2.5" style={{ ["--route-run" as string]: "2.4s" }}><TrainFront className="h-5 w-5 text-[#0057ff]" /></span>
              </div>
              {j.distanceKm ? <div className="mt-3 text-[11px] font-bold text-muted">{j.distanceKm.toLocaleString("en-IN")} km</div> : null}
            </div>
            <div className="text-right">
              <div className="text-3xl font-black tracking-tight text-ink md:text-4xl">{j.to?.code || "—"}</div>
              <div className="truncate text-xs font-semibold text-muted md:text-sm">{j.to?.name}</div>
              {(j.arrival || j.arrivalText) && <div className="mt-2 text-xs font-bold text-ink md:text-sm">Arrives {fmtWhen(j.arrival, j.arrivalText)}</div>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            {j.cls && <span className="rounded-full bg-surface px-3 py-1.5 text-ink">{j.cls} · {CLASS[j.cls] || "Class"}</span>}
            {j.quota && <span className="rounded-full bg-surface px-3 py-1.5 text-ink">{QUOTA[j.quota] || j.quota} quota</span>}
            {boardingDiffers && <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">Boarding at {j.boarding!.name} ({j.boarding!.code})</span>}
            {v.booking.fare != null && <span className="rounded-full bg-orange-50 px-3 py-1.5 text-brand">Fare ₹{v.booking.fare.toLocaleString("en-IN")}</span>}
          </div>
        </div>

        {/* perforation */}
        <div aria-hidden className="relative h-6">
          <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-surface" />
          <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-surface" />
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
        </div>

        {/* passengers */}
        <div className="px-5 pb-6 pt-2 md:px-7">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted"><Users className="h-3.5 w-3.5" /> {total} passenger{total === 1 ? "" : "s"}</div>
              <div className="mt-0.5 text-xl font-extrabold text-ink">{headline}</div>
            </div>
            <div className="flex gap-1.5 text-[11px] font-bold">
              {counts.cnf > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{counts.cnf} CNF</span>}
              {counts.rac > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{counts.rac} RAC</span>}
              {counts.wl > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">{counts.wl} WL</span>}
              {counts.can > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{counts.can} CAN</span>}
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {v.passengers.map((p, i) => {
              const cur = statusTone(p.current.status);
              const moved = p.booking.text && p.current.text && p.booking.status !== p.current.status;
              return (
                <motion.li key={p.n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="flex flex-col gap-3 rounded-2xl bg-surface/70 p-3 ring-1 ring-line sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:w-44">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-mono text-sm font-extrabold text-ink shadow-sm">{p.n}</span>
                    <div>
                      <div className="text-sm font-bold text-ink">Passenger {p.n}</div>
                      <div className="text-[11px] font-medium text-muted">Booked: <span className="font-mono">{p.booking.text || p.booking.status}</span></div>
                    </div>
                  </div>
                  {moved && <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" />}
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                    <span className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-extrabold ring-1", cur.chip)}>
                      <span className={cn("h-2 w-2 rounded-full", cur.dot)} />
                      {p.current.status}
                      {p.current.status.toUpperCase().startsWith("CNF") || /\d/.test(p.current.status) ? null : p.current.berth ? ` ${p.current.berth}` : ""}
                    </span>
                    {p.current.coach ? (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <span className="rounded-lg bg-white px-2 py-1 font-mono shadow-sm">{p.current.coach}</span>
                        <span className="rounded-lg bg-white px-2 py-1 font-mono shadow-sm">{p.current.berth ?? "—"}</span>
                        {p.current.berthCode && <span className="text-xs font-semibold text-muted">{BERTH[p.current.berthCode] || p.current.berthCode}</span>}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-muted">
                        {p.current.status.toUpperCase().includes("WL") ? (p.current.berth ? `Waitlist no. ${p.current.berth}` : "On the waitlist") : p.current.status.toUpperCase().startsWith("RAC") ? "Shares a side berth" : cur.label}
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/60 px-5 py-3 text-xs font-semibold text-muted md:px-7">
          <span className="flex items-center gap-1.5">
            <BadgeCheck className="h-4 w-4 text-mint" /> Updated {ago(res.fetchedAt)}{res.cached ? " · saved copy" : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {liveOn && (
              <Link href="/trains/live?tool=live" className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 font-bold text-sky-700 transition hover:-translate-y-0.5"><Radio className="h-3.5 w-3.5" /> Running status</Link>
            )}
            <button onClick={onRefresh} disabled={busy || !canRefresh} title={canRefresh ? "Get the latest status" : `A fresh status is available after ${clock(res.nextRefreshAt)}`} className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> {canRefresh ? "Refresh" : `Refresh after ${clock(res.nextRefreshAt)}`}
            </button>
          </div>
        </div>
      </div>
      {!res.loggedIn && (
        <p className="mx-auto mt-3 w-fit rounded-full bg-white px-4 py-1.5 text-center text-xs font-medium text-ink/70 shadow-soft ring-1 ring-line">
          <Link href={`/login?next=${encodeURIComponent("/trains/pnr")}`} className="font-bold text-brand underline">Log in</Link> to check more PNRs a day.
        </p>
      )}
    </motion.div>
  );
}
