"use client";
import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight, TrainFront } from "lucide-react";
import type { ScheduleStop } from "@/lib/server/train/types";
import { titleCase } from "@/lib/train/format";
import { cn } from "@/lib/utils";

type TrainAt = { code: string; label: string } | null | undefined;

/**
 * Route timeline. `stops` may be the full route (halts + pass-through stations).
 * Halts form the main line; pass-through stations are grouped between halts as
 * collapsible "intermediate stations". Long routes collapse to the halts that matter.
 */
export function ScheduleTimeline({ stops, from, to, collapsible = true, trainAt }: { stops: ScheduleStop[]; from?: string; to?: string; collapsible?: boolean; trainAt?: TrainAt }) {
  const halts = stops.filter((s) => s.is_stop !== false);
  const [all, setAll] = useState(!collapsible || halts.length <= 10);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const fi = halts.findIndex((s) => s.station_code === from);
  const ti = halts.findIndex((s) => s.station_code === to);
  const keep = (i: number) => all || i === 0 || i === halts.length - 1 || i === fi || i === ti || (fi >= 0 && ti >= 0 && i > fi && i < ti && ti - fi <= 6);
  const visible = halts.map((s, i) => ({ s, i })).filter(({ i }) => keep(i));
  const hidden = halts.length - visible.length;

  // pass-through stations between halt h and halt h+1 (by route sequence)
  const between = (h: number) => {
    const a = halts[h]?.sequence;
    const b = halts[h + 1]?.sequence;
    if (a === undefined || b === undefined) return [];
    return stops.filter((s) => s.is_stop === false && s.sequence > a && s.sequence < b);
  };
  const groupHasTrain = (h: number) => !!trainAt && between(h).some((s) => s.station_code === trainAt.code);
  const isOpen = (h: number) => open.has(h) || groupHasTrain(h);
  const toggle = (h: number) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(h)) n.delete(h);
    else n.add(h);
    return n;
  });

  return (
    <div>
      <ol className="relative">
        {visible.map(({ s, i }, k) => {
          const inSeg = fi >= 0 && ti >= 0 && i >= fi && i <= ti;
          const edge = i === fi || i === ti || (fi < 0 && (i === 0 || i === halts.length - 1));
          const gap = k > 0 && visible[k - 1].i !== i - 1;
          const nextVisibleAdjacent = k < visible.length - 1 && visible[k + 1].i === i + 1;
          const inter = nextVisibleAdjacent ? between(i) : [];
          const here = trainAt?.code === s.station_code;
          return (
            <Fragment key={s.sequence}>
              <motion.li data-code={s.station_code} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(k, 12) * 0.025 }} className={cn("relative grid grid-cols-[56px_22px_1fr_auto] items-center gap-2.5 rounded-xl py-1.5 transition-colors", here && "bg-sky-50 ring-1 ring-sky-200")}>
                {gap && <span className="absolute -top-1 left-[67px] text-[9px] font-bold text-muted">⋮</span>}
                <div className="text-right text-[13px] font-extrabold tabular-nums text-ink">{s.departure_time || s.arrival_time}</div>
                <div className="relative flex h-full justify-center">
                  {k < visible.length - 1 && <span className={cn("absolute top-1/2 h-[calc(100%+12px)] w-[3px] rounded-full", inSeg && i < ti ? "bg-gradient-to-b from-brand to-brand-2" : "bg-line")} />}
                  {here && <TrainPin />}
                  <span className={cn("relative z-10 rounded-full border-[3px] bg-white", edge ? "h-4 w-4 border-brand shadow-[0_0_0_4px_rgba(255,90,31,0.15)]" : inSeg ? "h-3 w-3 border-brand" : "h-3 w-3 border-ink/25")} />
                </div>
                <div className="min-w-0">
                  <div className={cn("flex items-center gap-1.5 truncate text-sm", edge ? "font-extrabold text-ink" : "font-semibold text-ink/80")}>
                    <span className="truncate">{titleCase(s.station_name)}</span>
                    <span className="font-mono text-[10px] text-muted">{s.station_code}</span>
                    {i === fi && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">BOARD</span>}
                    {i === ti && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">ALIGHT</span>}
                    {here && <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{trainAt!.label}</span>}
                  </div>
                  <div className="flex gap-2 text-[11px] text-muted">
                    <span>Day {s.day}</span>
                    <span>{Math.round(s.distance_km)} km</span>
                    {s.halt_minutes ? <span>{s.halt_minutes}m halt</span> : null}
                    {(s.departure_delay_minutes ?? 0) > 5 && <span className="font-semibold text-orange-600">avg +{s.departure_delay_minutes}m</span>}
                  </div>
                </div>
                {s.platform_number ? <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-ink/70">PF {s.platform_number}</span> : <span />}
              </motion.li>

              {inter.length > 0 && (
                <li className="relative">
                  <div className="grid grid-cols-[56px_22px_1fr] items-center gap-2.5">
                    <span />
                    <div className="relative flex h-full justify-center">
                      <span className={cn("absolute -top-3 h-[calc(100%+24px)] w-[3px] rounded-full", inSeg && i < ti ? "bg-gradient-to-b from-brand to-brand-2" : "bg-line")} />
                    </div>
                    <button onClick={() => toggle(i)} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-muted transition hover:bg-surface hover:text-ink">
                      {isOpen(i) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {inter.length} intermediate station{inter.length > 1 ? "s" : ""}
                      <span className="font-medium opacity-70">· {Math.round(halts[i + 1].distance_km - s.distance_km)} km</span>
                      {groupHasTrain(i) && <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] text-white">TRAIN HERE</span>}
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen(i) && (
                      <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        {inter.map((p) => {
                          const pHere = trainAt?.code === p.station_code;
                          return (
                            <li key={p.sequence} data-code={p.station_code} className={cn("grid grid-cols-[56px_22px_1fr_auto] items-center gap-2.5 rounded-lg py-[3px]", pHere && "bg-sky-50 ring-1 ring-sky-200")}>
                              <span className="text-right text-[11px] font-semibold tabular-nums text-muted">{p.departure_time || p.arrival_time || ""}</span>
                              <div className="relative flex h-full justify-center">
                                <span className={cn("absolute inset-y-0 w-[3px]", inSeg && i < ti ? "bg-brand/40" : "bg-line")} />
                                {pHere ? <TrainPin small /> : <span className="relative z-10 mt-[7px] h-1.5 w-1.5 rounded-full bg-ink/25" />}
                              </div>
                              <span className="truncate text-xs text-ink/60">
                                {titleCase(p.station_name)} <span className="font-mono text-[10px] text-muted">{p.station_code}</span>
                                {pHere && <span className="ml-1.5 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{trainAt!.label}</span>}
                              </span>
                              <span className="text-[10px] text-muted">{Math.round(p.distance_km)} km</span>
                            </li>
                          );
                        })}
                      </motion.ol>
                    )}
                  </AnimatePresence>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {hidden > 0 && (
        <button onClick={() => setAll(true)} className="mt-2 flex items-center gap-1 pl-[78px] text-xs font-bold text-brand hover:underline">
          <ChevronDown className="h-3.5 w-3.5" /> Show all {halts.length} halts
        </button>
      )}
    </div>
  );
}

function TrainPin({ small }: { small?: boolean }) {
  return (
    <span className={cn("absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_0_0_6px_rgba(56,189,248,0.25)]", small ? "h-5 w-5" : "h-7 w-7")}>
      <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/50" />
      <TrainFront className={cn("relative", small ? "h-3 w-3" : "h-3.5 w-3.5")} />
    </span>
  );
}
