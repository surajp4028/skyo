"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RouteRunner } from "@/components/ui/route-runner";
import { Clock, Radio, Route, Star, TrainFront, UtensilsCrossed } from "lucide-react";
import type { RouteTrain } from "@/lib/server/train/types";
import { AvailabilityPanel } from "./availability-panel";
import { TrainDrawer } from "./train-drawer";
import { useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";
import { CLASS_NAMES, DAYS, arrivalDayOffset, fmtDuration, fmtINR, prettyType, statusTone, titleCase, weekdayOf } from "@/lib/train/format";
import { cn } from "@/lib/utils";

export function TrainCard({ t, from, to, date, quota, index }: { t: RouteTrain; from: string; to: string; date: string; quota: string; index: number }) {
  const [openCls, setOpenCls] = useState<string | null>(null);
  const [insight, setInsight] = useState<null | "route" | "live">(null);
  const liveOn = isTrainLiveOn(useSite());
  const offset = arrivalDayOffset(t.departure_time, t.duration_minutes);
  const runsToday = t.running_days?.includes(weekdayOf(date));
  const boardFrom = t.from_station_code || from;
  const alightTo = t.to_station_code || to;
  const classes = t.classes?.length ? t.classes : (t.availability_summary || []).map((a) => a.class_code);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, type: "spring", stiffness: 200, damping: 24 }}
      className="group relative overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-soft transition hover:shadow-[0_20px_50px_-20px_rgba(10,15,31,0.25)]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-2 opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold text-ink">{titleCase(t.train_name)}</h3>
            <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-xs font-bold text-white">{t.train_number}</span>
            <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-ink/60">{prettyType(t.train_type)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="flex gap-0.5">
              {DAYS.map((d) => (
                <span key={d} className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold", t.running_days?.includes(d) ? "bg-brand-soft text-brand" : "text-ink/25")}>{d[0]}</span>
              ))}
            </span>
            {t.on_time_rating != null && <span className="flex items-center gap-1 font-semibold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {t.on_time_rating.toFixed(1)} on-time</span>}
            {t.has_pantry && <span className="flex items-center gap-1 font-semibold"><UtensilsCrossed className="h-3.5 w-3.5" /> Pantry</span>}
            {!runsToday && <span className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-600">Doesn&apos;t run on this day</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setInsight(insight === "route" ? null : "route")} className={cn("flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition", insight === "route" ? "bg-ink text-white" : "text-ink/70 hover:bg-surface hover:text-ink")}>
            <Route className="h-3.5 w-3.5" /> Route
          </button>
          {liveOn && (
            <button onClick={() => setInsight(insight === "live" ? null : "live")} className={cn("flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition", insight === "live" ? "bg-ink text-white" : "text-sky-600 hover:bg-sky/10")}>
              <Radio className="h-3.5 w-3.5" /> Live
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div>
          <div className="text-2xl font-extrabold tabular-nums text-ink">{t.departure_time}</div>
          <div className="max-w-[160px] truncate text-xs font-semibold text-muted">{titleCase(t.from_station_name) || boardFrom} · <span className="font-mono">{boardFrom}</span></div>
        </div>
        <div className="relative flex flex-col items-center">
          <span className="flex items-center gap-1 text-xs font-bold text-ink/70"><Clock className="h-3.5 w-3.5" /> {fmtDuration(t.duration_minutes)}</span>
          <div className="relative mt-1.5 h-[2px] w-full bg-[repeating-linear-gradient(90deg,#0a0f1f30_0_6px,transparent_6px_10px)]">
            <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full border-2 border-ink bg-white" />
            <span className="absolute -right-1 -top-[3px] h-2 w-2 rounded-full bg-ink" />
            <RouteRunner className="-top-[9px] text-brand" duration={2.4}>
              <TrainFront className="h-4 w-4" />
            </RouteRunner>
          </div>
          {t.distance_km != null && <span className="mt-1.5 text-[11px] text-muted">{Math.round(t.distance_km)} km</span>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums text-ink">
            {t.arrival_time}
            {offset > 0 && <sup className="ml-0.5 text-xs font-bold text-brand">+{offset}</sup>}
          </div>
          <div className="max-w-[160px] truncate text-xs font-semibold text-muted">{titleCase(t.to_station_name) || alightTo} · <span className="font-mono">{alightTo}</span></div>
        </div>
      </div>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {classes.map((c) => {
          const a = t.availability_summary?.find((x) => x.class_code === c);
          const tone = statusTone(a?.status);
          const active = openCls === c;
          return (
            <button
              key={c}
              onClick={() => setOpenCls(active ? null : c)}
              className={cn("min-w-[124px] shrink-0 rounded-2xl p-3 text-left ring-1 transition", tone.bg, active ? "ring-2 ring-brand" : tone.ring, "hover:-translate-y-0.5")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-ink">{c}</span>
                <span className="text-xs font-bold text-ink/70">{a?.fare ? fmtINR(a.fare) : ""}</span>
              </div>
              <div className={cn("mt-1 truncate text-[13px] font-extrabold", tone.text)}>{a?.text || tone.label}</div>
              <div className="mt-0.5 truncate text-[10px] text-muted">{CLASS_NAMES[c] || c}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {insight && <TrainDrawer train={t.train_number} name={t.train_name} from={boardFrom} to={alightTo} date={date} tab={insight} onClose={() => setInsight(null)} />}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {openCls && <AvailabilityPanel name={titleCase(t.train_name)} train={t.train_number} from={boardFrom} to={alightTo} date={date} cls={openCls} quota={quota} />}
      </AnimatePresence>

    </motion.article>
  );
}
