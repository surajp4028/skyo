"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { ArrowRight, Armchair, Lightbulb, Loader2, Repeat2, TrainFront, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { BookingSheet, type BookingIntent } from "./booking-sheet";
import { CLASS_NAMES, fmtINR, titleCase } from "@/lib/train/format";
import { cn } from "@/lib/utils";

export type Leg = { from: string; fromName: string; to: string; toName: string; date: string; dep: string | null; arr: string | null; status: string; text: string; fare: number | null; chance: number | null };
type Level = "confirmed" | "likely";
type Result = {
  train: string; cls: string; checked: number;
  bookFrom: (Leg & { boardAt: string; boardAtName: string; level: Level })[];
  split: { via: string; viaName: string; viaTime: string | null; legs: [Leg, Leg]; total: number | null; level: Level; chance: number | null }[];
  tried: { kind: "from" | "split"; station: string; status: string }[];
  own?: Leg;
};

const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/*
 * Alternate seats are checked in the background (each check spends RailCore credits):
 *  - ONE request per train covering all its waitlisted classes, once that train card is on screen;
 *  - requests run one after another (RailCore allows ~20 requests a minute — firing them together got throttled);
 *  - never twice for the same train in one search;
 *  - when Admin turns on "Limit alternate-seat checks", at most `train_alt_auto` class checks per search.
 */
type ByClass = Record<string, Result>;
const searches = new Map<string, { used: number; trains: Map<string, Promise<ByClass | null>> }>();
let queue: Promise<unknown> = Promise.resolve();
/** run one request at a time, with a short gap between them */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(() => new Promise((r) => setTimeout(r, 350)), () => new Promise((r) => setTimeout(r, 350)));
  return run;
}

export type TrainAltProps = { train: string; name: string; from: string; to: string; date: string; quota: string };

/** All waitlisted classes of one train, checked in one request. Returns the results by class as they arrive. */
export function useTrainAlternates(p: TrainAltProps & { classes: string[]; enabled: boolean; max: number | null; searchKey: string }): ByClass {
  const [data, setData] = useState<ByClass>({});
  const classKey = p.classes.join(",");
  useEffect(() => {
    if (!p.enabled || !classKey || (p.max != null && p.max <= 0)) return;
    let search = searches.get(p.searchKey);
    if (!search) {
      if (searches.size > 20) searches.clear();
      search = { used: 0, trains: new Map() };
      searches.set(p.searchKey, search);
    }
    let req = search.trains.get(p.train);
    if (!req) {
      let classes = classKey.split(",");
      if (p.max != null) classes = classes.slice(0, Math.max(0, p.max - search.used));
      if (!classes.length) return;
      search.used += classes.length;
      const qs = new URLSearchParams({ train: p.train, from: p.from, to: p.to, date: p.date, classes: classes.join(","), quota: p.quota, search: p.searchKey.toUpperCase() });
      req = enqueue(() => api<{ data: { classes: ByClass } }>(`/api/train/alternate?${qs}`, { method: "GET" }))
        .then((r) => r.data.classes)
        .catch(() => null); // nothing to show — never surface errors here
      search.trains.set(p.train, req);
    }
    let alive = true;
    req.then((d) => alive && d && setData(d));
    return () => {
      alive = false;
    };
  }, [p.enabled, p.max, p.searchKey, p.train, p.from, p.to, p.date, p.quota, classKey]);
  return data;
}

/** What the chip says: a confirmed option (cheapest) beats a likely one (highest chance). */
function headline(d: Result): { level: Level; fare: number | null; chance: number | null } | null {
  const opts = [
    ...d.bookFrom.map((b) => ({ level: b.level, fare: b.fare, chance: b.chance })),
    ...d.split.map((s) => ({ level: s.level, fare: s.total, chance: s.chance })),
  ];
  const conf = opts.filter((o) => o.level === "confirmed");
  if (conf.length) return conf.sort((a, b) => (a.fare ?? 1e9) - (b.fare ?? 1e9))[0];
  return opts.sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0))[0] ?? null;
}

type AltProps = TrainAltProps & { cls: string };

/** Under a class tile: renders "Alternate seat ₹X" / "94% chance ₹X" only when the check found something. */
export function AlternateSeatChip({ data, ...p }: AltProps & { data?: Result }) {
  const [open, setOpen] = useState(false);
  const best = data ? headline(data) : null;
  if (!data || !best) return null;
  const likely = best.level === "likely";
  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setOpen(true)}
        className={cn("mx-auto -mt-1 flex w-[94%] items-center justify-center gap-0.5 rounded-b-lg border border-t-0 bg-white px-1.5 pb-1 pt-1.5 text-[9.5px] font-extrabold shadow-sm transition sm:rounded-b-xl sm:py-1.5 sm:text-[11px]", likely ? "border-sky-200 text-sky-700 hover:bg-sky-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")}
      >
        <Lightbulb className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
        <span className="whitespace-nowrap tracking-tight">{likely ? `${best.chance}% chance` : "Alternate seat"}{best.fare != null ? ` ${fmtINR(best.fare)}` : ""}</span>
      </motion.button>
      {open && <AlternateDialog {...p} data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function AlternateDialog({ train, name, date, cls, quota, data, onClose }: AltProps & { data: Result; onClose: () => void }) {
  const [book, setBook] = useState<BookingIntent | null>(null);
  const state: { loading: boolean; data?: Result; err?: string; login?: boolean } = { loading: false, data };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const d = state.data;
  const found = d ? d.bookFrom.length + d.split.length : 0;
  const intent = (l: Leg): BookingIntent => ({ train, name, from: l.from, to: l.to, date: l.date, cls, quota, status: l.status, text: l.text, fare: l.fare, totalFare: l.fare });

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Lightbulb className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Same train, better seat</h2>
            <p className="truncate text-xs font-semibold text-muted">
              {dayLabel(date)} · {train} {titleCase(name)} · {cls} {CLASS_NAMES[cls] ? `· ${CLASS_NAMES[cls]}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-surface"><X className="h-5 w-5" /></button>
        </div>

        {state.loading && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking earlier stations and change-over points on this train…
            </div>
            {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface" />)}
          </div>
        )}

        {state.err && (
          <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800">
            {state.err}
            {state.login && <div className="mt-3"><Link href="/login" className="inline-flex rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white">Log in</Link></div>}
          </div>
        )}

        {d && (
          <div className="mt-5 space-y-4">
            {found === 0 && (
              <div className="rounded-3xl border border-dashed border-line p-5 text-center">
                <Armchair className="mx-auto h-7 w-7 text-muted" />
                <p className="mt-2 text-sm font-bold">No better seat on this train right now.</p>
                <p className="mt-1 text-xs text-muted">We checked {d.checked} options: {d.tried.map((t) => `${t.kind === "from" ? "from" : "via"} ${t.station} (${t.status.toLowerCase().replace(/_/g, " ")})`).join(" · ")}.</p>
              </div>
            )}

            {d.bookFrom.map((b) => (
              <motion.section key={`f-${b.from}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-emerald-200">
                <div className="flex items-center justify-between bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  <span>Book from an earlier station</span>
                  <LevelBadge level={b.level} chance={b.chance} />
                </div>
                <div className="p-4">
                  <RouteLine
                    points={[
                      { label: "Book from", code: b.from, name: b.fromName, time: hm(b.dep), dim: true },
                      { label: "Boarding", code: b.boardAt, name: b.boardAtName, time: "", strong: true },
                      { label: "Deboarding", code: b.to, name: b.toName, time: hm(b.arr) },
                    ]}
                  />
                  <BookBar className="mt-4" cls={cls} leg={b} level={b.level} label={b.level === "confirmed" ? "Confirmed" : "High chance"} onBook={() => setBook(intent(b))} />
                  <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                    The ticket is from {titleCase(b.fromName)}; you board at {titleCase(b.boardAtName)}. Set the boarding point to {b.boardAt} on IRCTC after booking (allowed up to 24 h before the chart).
                  </p>
                </div>
              </motion.section>
            ))}

            {d.split.map((s) => (
              <motion.section key={`s-${s.via}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-emerald-200">
                <div className="flex items-center justify-between bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  <span className="flex items-center gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> Change seat on the way</span>
                  <LevelBadge level={s.level} chance={s.chance} />
                </div>
                <div className="p-4">
                  <RouteLine
                    points={[
                      { label: "Boarding", code: s.legs[0].from, name: s.legs[0].fromName, time: hm(s.legs[0].dep), strong: true },
                      { label: "Change seat", code: s.via, name: s.viaName, time: hm(s.viaTime), badge: "Same train" },
                      { label: "Book upto", code: s.legs[1].to, name: s.legs[1].toName, time: hm(s.legs[1].arr) },
                    ]}
                  />
                  <div className="mt-4 space-y-2">
                    {s.legs.map((l, i) => (
                      <BookBar
                        key={i}
                        cls={cls}
                        leg={l}
                        level={l.status === "AVAILABLE" ? "confirmed" : "likely"}
                        label={`${i ? "2nd" : "1st"} ticket`}
                        onBook={() => setBook(intent(l))}
                      />
                    ))}
                    {s.total != null && (
                      <div className="flex items-center justify-between px-1 pt-1 text-sm">
                        <span className="font-semibold text-muted">Total for both tickets</span>
                        <span className="font-black text-ink">{fmtINR(s.total)}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                    Two separate tickets on the same train. At {titleCase(s.viaName)} you move to your second seat — no need to get off.
                  </p>
                </div>
              </motion.section>
            ))}
            <p className="text-center text-[10px] text-muted">Live from RailCore · seats can change quickly — booking re-checks before you pay.</p>
          </div>
        )}
      </motion.div>
      <AnimatePresence>{book && <BookingSheet b={book} onClose={() => setBook(null)} />}</AnimatePresence>
    </div>,
    document.body,
  );
}

/** "AVAILABLE-0125" → "AVL 125", "GNWL11/WL9" → "WL 9" */
function short(text: string) {
  const cur = text.split("/").pop()!.trim();
  const avl = cur.match(/^(?:AVAILABLE|AVL)[-\s]*0*(\d+)/i);
  if (avl) return `AVL ${avl[1]}`;
  const wl = cur.match(/^([A-Z]*WL|RAC)\s*0*(\d+)/i);
  if (wl) return `${wl[1].toUpperCase().endsWith("WL") ? "WL" : "RAC"} ${wl[2]}`;
  return cur;
}

/** One bookable ticket: class + status + price on the left, a compact Book button on the right. */
function BookBar({ cls, leg, level, label, onBook, className }: { cls: string; leg: Leg; level: Level; label: string; onBook: () => void; className?: string }) {
  const ok = level === "confirmed";
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-2 pl-3 ring-1", ok ? "bg-emerald-50/70 ring-emerald-200" : "bg-sky-50/70 ring-sky-200", className)}>
      <span className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-xs font-black shadow-sm", ok ? "text-emerald-700" : "text-sky-700")}>{cls}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className={cn("whitespace-nowrap text-sm font-extrabold leading-tight", ok ? "text-emerald-700" : "text-sky-700")}>{short(leg.text)}</div>
        {!ok && leg.chance != null && <div className="whitespace-nowrap text-[10.5px] font-bold text-sky-600">{leg.chance}% chance</div>}
      </div>
      <div className="shrink-0 text-right">
        {leg.fare != null && <div className="text-base font-black leading-none text-ink">{fmtINR(leg.fare)}</div>}
        <div className="text-[9px] font-semibold text-muted">per person</div>
      </div>
      <button
        onClick={onBook}
        className={cn(
          "group relative flex h-11 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl px-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5",
          ok ? "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_10px_24px_-10px_rgba(5,150,105,.9)]" : "bg-gradient-to-r from-sky-500 to-[#0057ff] shadow-[0_10px_24px_-10px_rgba(0,87,255,.8)]",
        )}
      >
        <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/30 transition-all duration-700 group-hover:left-[120%]" />
        Book <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function RouteLine({ points }: { points: { label: string; code: string; name: string; time: string; strong?: boolean; dim?: boolean; badge?: string }[] }) {
  return (
    <div className="rounded-2xl bg-sky-50/70 px-3 py-4 sm:px-5">
      <div className="relative grid grid-cols-3">
        <span aria-hidden className="absolute left-[16%] right-[16%] top-[30px] border-t-2 border-sky-300" />
        {points.map((p, i) => (
          <div key={p.code + i} className={cn("relative flex flex-col", i === 0 ? "items-start text-left" : i === 2 ? "items-end text-right" : "items-center text-center")}>
            {p.badge && <span className="absolute -top-3.5 rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-white">{p.badge}</span>}
            <span className="text-[11px] font-extrabold text-[#0057ff]">{p.label}</span>
            <span className={cn("relative z-10 mt-1.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-sky-50", p.strong ? "bg-[#0057ff] text-white" : p.dim ? "bg-white text-sky-500 ring-sky-50" : "bg-white text-[#0057ff]")}>
              <TrainFront className="h-3.5 w-3.5" />
            </span>
            <span className="mt-1.5 text-xs font-extrabold leading-tight text-ink sm:text-sm">{titleCase(p.name)}</span>
            <span className="font-mono text-[10px] font-bold text-muted">{p.code}{p.time ? ` ${p.time}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelBadge({ level, chance }: { level: Level; chance: number | null }) {
  return level === "confirmed" ? (
    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-white">Confirmed</span>
  ) : (
    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-white">{chance}% chance</span>
  );
}
