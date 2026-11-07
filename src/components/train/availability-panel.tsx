"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CalendarRange, Lock, RefreshCw, Sparkles } from "lucide-react";
import { trainApi, needsLogin } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import { CLASS_NAMES, fmtINR, prettyDate, statusTone } from "@/lib/train/format";
import type { AvailabilityCalendar, AvailabilityResponse } from "@/lib/server/train/types";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "motion/react";
import { BookButton, BookingSheet } from "./booking-sheet";

type P = { train: string; name?: string; from: string; to: string; date: string; cls: string; quota: string };

/** Live seat availability for one class (5 credits) + optional 7-day calendar (4 credits) — only on user action. */
export function AvailabilityPanel(p: P) {
  const [state, setState] = useState<{ key: string; data?: AvailabilityResponse; error?: string; login?: boolean } | null>(null);
  const [cal, setCal] = useState<{ loading: boolean; data?: AvailabilityCalendar; error?: string } | null>(null);
  const key = `${p.train}|${p.from}|${p.to}|${p.date}|${p.cls}|${p.quota}`;
  const [tick, setTick] = useState(0);
  const [book, setBook] = useState(false);

  useEffect(() => {
    let alive = true;
    trainApi<AvailabilityResponse>("/availability", { train: p.train, from: p.from, to: p.to, date: p.date, class: p.cls, quota: p.quota })
      .then((r) => alive && setState({ key, data: r.data }))
      .catch((e) => alive && setState({ key, error: errMsg(e), login: needsLogin(e) }));
    return () => {
      alive = false;
    };
  }, [key, tick, p.train, p.from, p.to, p.date, p.cls, p.quota]);

  const loading = !state || state.key !== key;
  const detail = state?.data?.classes.find((c) => c.class_code === p.cls) || state?.data?.classes[0];
  const tone = statusTone(detail?.status);
  const prob = detail?.confirmation_probability;

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="mt-4 rounded-2xl border border-line bg-surface/70 p-4">
        {loading ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-muted"><RefreshCw className="h-4 w-4 animate-spin" /> Checking live availability for {CLASS_NAMES[p.cls] || p.cls}…</div>
        ) : state?.login ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Lock className="h-4 w-4 text-brand" /> Log in to check live seat availability.</div>
            <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/trains")}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">Log in</Link>
          </div>
        ) : state?.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-red-600"><AlertTriangle className="h-4 w-4" /> {state.error}</span>
            <button onClick={() => setTick((t) => t + 1)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-ink hover:bg-white">Retry</button>
          </div>
        ) : detail ? (
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted">{CLASS_NAMES[detail.class_code] || detail.class_code} · {prettyDate(p.date)}</div>
              <div className={cn("mt-1 text-2xl font-extrabold", tone.text)}>{detail.availability_text || tone.label}</div>
              {detail.wl_pool && <div className="text-xs text-muted">Pool {detail.wl_pool}{detail.wl_pool_position ? ` · booked at #${detail.wl_pool_position}` : ""}</div>}
            </div>
            <div>
              {prob ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold"><span className="flex items-center gap-1 text-muted"><Sparkles className="h-3.5 w-3.5 text-brand" /> Confirmation chance</span><span>{prob.percentage}%</span></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${prob.percentage}%` }} transition={{ duration: 0.9, ease: "easeOut" }} className={cn("h-full rounded-full", prob.label === "HIGH" ? "bg-emerald-500" : prob.label === "MEDIUM" ? "bg-amber-500" : "bg-red-500")} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{prob.text}</div>
                </div>
              ) : (
                <div className="text-xs text-muted">Confirmation estimate not available for this status.</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">{detail.catering_charge ? "Fare incl. food" : "Fare"}</div>
              <div className="text-2xl font-extrabold text-ink">{fmtINR(detail.total_fare ?? detail.fare)}</div>
              {detail.catering_charge ? (
                <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink/70 ring-1 ring-line">
                  {fmtINR(detail.fare)} without food
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">No availability returned for this class.</div>
        )}

        {!loading && detail && (
          <div className="mt-4 border-t border-line pt-3">
            {!cal ? (
              <button
                onClick={() => {
                  setCal({ loading: true });
                  trainApi<AvailabilityCalendar>("/availability/calendar", { train: p.train, from: p.from, to: p.to, class: p.cls, quota: p.quota, date: p.date, days: 7 })
                    .then((r) => setCal({ loading: false, data: r.data }))
                    .catch((e) => setCal({ loading: false, error: errMsg(e) }));
                }}
                className="flex items-center gap-2 text-xs font-bold text-brand hover:underline"
              >
                <CalendarRange className="h-4 w-4" /> Show next 7 days
              </button>
            ) : cal.loading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-muted"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading 7-day availability…</div>
            ) : cal.error ? (
              <div className="text-xs font-semibold text-red-600">{cal.error}</div>
            ) : (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {cal.data?.days.map((d, i) => {
                  const t = statusTone(d.status);
                  return (
                    <motion.div key={d.date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={cn("min-w-[110px] rounded-xl bg-white p-2.5 ring-1", t.ring)}>
                      <div className="text-[11px] font-bold text-muted">{prettyDate(d.date)}</div>
                      <div className={cn("mt-0.5 text-sm font-extrabold", t.text)}>{d.availability_text}</div>
                      <div className="text-[11px] text-muted">{fmtINR(d.fare)}{d.confirmation_probability ? ` · ${d.confirmation_probability.percentage}%` : ""}</div>
                    </motion.div>
                  );
                })}
                {cal.data && cal.data.days.length === 0 && <div className="text-xs text-muted">The train doesn&apos;t run in this window.</div>}
              </div>
            )}
          </div>
        )}
        {!loading && state?.data && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] text-muted">
              Checked {new Date(state.data.enquiry_checked_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · Live data by RailCore · Verify on IRCTC before booking
            </span>
            <BookButton label={`Book ${p.cls}`} onClick={() => setBook(true)} />
          </div>
        )}
        <AnimatePresence>
          {book && (
            <BookingSheet
              onClose={() => setBook(false)}
              b={{ train: p.train, name: p.name, from: p.from, to: p.to, date: p.date, cls: p.cls, quota: p.quota, status: detail?.status, text: detail?.availability_text, fare: detail?.total_fare ?? detail?.fare, baseFare: detail?.fare, catering: detail?.catering_charge ?? 0, totalFare: detail?.total_fare }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
