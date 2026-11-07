"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ChevronDown, Clock4, Lock, MapPin, Navigation, Radio, RefreshCw, TrainFront } from "lucide-react";
import { trainApi, needsLogin } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { LiveTrainStatus } from "@/lib/server/train/types";
import { Meteors } from "@/components/ui/meteors";
import { fmtClock, istISO, prettyDate, titleCase } from "@/lib/train/format";
import { cn } from "@/lib/utils";

/**
 * Live running status (5 credits per check). Fetches only after the user asks
 * (or when `autoLoad` is set by the live-finder page).
 */
export function LiveStatus({ train, initialDate, from, to, autoLoad, compact, onData }: { train: string; initialDate?: string; from?: string; to?: string; autoLoad?: boolean; compact?: boolean; onData?: (d: LiveTrainStatus) => void }) {
  const dates = [istISO(0), istISO(-1), istISO(-2)];
  const [date, setDate] = useState(initialDate && dates.includes(initialDate) ? initialDate : dates[0]);
  const [req, setReq] = useState<number>(autoLoad ? 1 : 0);
  const [s, setS] = useState<{ key: string; data?: LiveTrainStatus; error?: string; login?: boolean } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const key = `${train}|${date}|${req}`;

  useEffect(() => {
    if (!req) return;
    let alive = true;
    trainApi<LiveTrainStatus>(`/trains/${train}/live`, { date })
      .then((r) => {
        if (!alive) return;
        setS({ key, data: r.data });
        onData?.(r.data);
      })
      .catch((e) => alive && setS({ key, error: errMsg(e), login: needsLogin(e) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onData is a notification callback
  }, [req, train, date, key]);

  const loading = req > 0 && s?.key !== key;
  const d = s?.key === key ? s.data : s?.data;
  const delay = d?.delay_minutes ?? null;
  const delayTone = delay === null ? "bg-white/10 text-white" : delay <= 5 ? "bg-emerald-400/20 text-emerald-200" : delay <= 30 ? "bg-amber-400/20 text-amber-200" : "bg-red-400/20 text-red-200";

  const stops = d ? d.stations.filter((x) => x.is_stopping || x.station_code === d.current_station_code) : [];
  const curIdx = d ? Math.max(0, stops.findIndex((x) => x.station_code === d.current_station_code)) : 0;
  const shown = showAll ? stops : stops.slice(Math.max(0, curIdx - 2), curIdx + 5);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {dates.map((x, i) => (
          <button key={x} onClick={() => setDate(x)} className={cn("rounded-xl border px-3 py-2 text-xs font-bold transition", date === x ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70 hover:border-ink/30")}>
            {i === 0 ? "Started today" : i === 1 ? "Yesterday" : prettyDate(x, { weekday: "short", day: "numeric" })}
          </button>
        ))}
        <button onClick={() => setReq((n) => n + 1)} disabled={loading} className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-extrabold text-white shadow-[0_10px_30px_-10px_rgba(255,90,31,0.8)] disabled:opacity-60">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} {d ? "Refresh" : "Check live status"}
        </button>
      </div>

      {!loading && s?.login && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4">
          <span className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand" /> Log in to see the live running status.</span>
          <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/trains/live")}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">Log in</Link>
        </div>
      )}
      {!loading && s?.error && !s.login && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> {s.error}</div>}
      {loading && !d && (
        <div className="mt-4 h-40 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />
      )}

      {d && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: loading ? 0.6 : 1, y: 0 }} className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#0a0f1f,#162154_60%,#2a1a3f)] p-5 text-white">
            <Meteors number={10} />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/30 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cn("rounded-full px-2.5 py-1 font-extrabold", delayTone)}>{delay === null ? "Live" : delay <= 0 ? "On time" : `${delay} min late`}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-bold">{d.status.replace(/_/g, " ")}</span>
                <span className="text-white/50">Updated {fmtClock(d.last_reported_at || d.freshness?.retrieved_at)}</span>
              </div>
              <h3 className={cn("mt-2 font-extrabold", compact ? "text-lg" : "text-xl")}>{d.status_text || "Live status"}</h3>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/70">
                {d.current_station_name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {titleCase(d.current_station_name)}</span>}
                {d.approaching_station_name && <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> Next {titleCase(d.approaching_station_name)}</span>}
                {d.eta_destination_at && <span className="flex items-center gap-1"><Clock4 className="h-3.5 w-3.5" /> {d.destination_station_code} at {fmtClock(d.eta_destination_at)}</span>}
              </div>
              <div className="relative mt-5 h-2.5 rounded-full bg-white/10">
                <motion.div initial={{ width: 0 }} animate={{ width: `${d.progress_percent ?? 0}%` }} transition={{ duration: 1.2, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" />
                <motion.div initial={{ left: "0%" }} animate={{ left: `${Math.min(97, d.progress_percent ?? 0)}%` }} transition={{ duration: 1.2, ease: "easeOut" }} className="absolute -top-3 -translate-x-1/2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand shadow-lg"><TrainFront className="h-4 w-4" /></span>
                </motion.div>
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-white/55">
                <span>{d.source_station_code}</span>
                <span>{d.distance_covered_km != null && d.total_distance_km ? `${Math.round(d.distance_covered_km)} / ${Math.round(d.total_distance_km)} km` : ""}</span>
                <span>{d.destination_station_code}</span>
              </div>
              {d.official_notice?.message && <div className="mt-3 rounded-xl bg-amber-400/15 p-2.5 text-xs text-amber-200">{d.official_notice.message}</div>}
            </div>
          </div>

          <ol className="rounded-2xl border border-line bg-white px-4 py-3">
            {shown.map((st) => {
              const isCur = st.station_code === d.current_station_code;
              const passed = st.travelled || st.has_departed;
              const mine = (from && st.station_code === from) || (to && st.station_code === to);
              const dl = st.delay_departure_minutes ?? st.delay_arrival_minutes;
              return (
                <li key={st.sequence} className="relative grid grid-cols-[22px_1fr_auto] items-center gap-3 py-1.5">
                  <div className="relative flex h-full justify-center">
                    <span className={cn("absolute top-1/2 h-[calc(100%+12px)] w-[3px]", passed ? "bg-brand" : "bg-line")} />
                    <span className={cn("relative z-10 h-3.5 w-3.5 rounded-full border-[3px]", isCur ? "border-brand bg-brand" : passed ? "border-brand bg-white" : "border-ink/20 bg-white")}>
                      {isCur && <span className="absolute -inset-1.5 animate-ping rounded-full bg-brand/40" />}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className={cn("truncate text-[13px] font-bold", passed || isCur ? "text-ink" : "text-ink/60")}>
                      {titleCase(st.station_name) || st.station_code} <span className="font-mono text-[10px] text-muted">{st.station_code}</span>
                      {mine && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold text-brand">YOUR STOP</span>}
                    </div>
                    <div className="text-[11px] text-muted">
                      Sch {fmtClock(st.scheduled_departure || st.scheduled_arrival)} · {passed ? `Act ${fmtClock(st.actual_departure || st.actual_arrival)}` : `Exp ${fmtClock(st.etd || st.eta)}`}
                      {st.platform_number ? ` · PF ${st.platform_number}` : ""}
                    </div>
                  </div>
                  {dl != null && <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", dl <= 5 ? "bg-emerald-50 text-emerald-700" : dl <= 30 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>{dl <= 0 ? "On time" : `+${dl}m`}</span>}
                </li>
              );
            })}
            {stops.length > shown.length && (
              <button onClick={() => setShowAll(true)} className="mt-1 flex items-center gap-1 text-xs font-bold text-brand hover:underline"><ChevronDown className="h-3.5 w-3.5" /> All {stops.length} stations</button>
            )}
          </ol>
          <p className="text-[10px] text-muted">Live data by RailCore · confidence {d.confidence} · Not affiliated with Indian Railways</p>
        </motion.div>
      )}
    </div>
  );
}
