"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RouteRunner } from "@/components/ui/route-runner";
import { ChevronLeft, ChevronRight, Clock, Radio, Route, Star, TrainFront, UtensilsCrossed } from "lucide-react";
import type { RouteTrain } from "@/lib/server/train/types";
import { AvailabilityPanel } from "./availability-panel";
import { AlternateSeatChip, useTrainAlternates } from "./alternate-seat";
import { TrainDrawer } from "./train-drawer";
import { useAuth, useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";
import { CLASS_NAMES, DAYS, arrivalDayOffset, fmtDuration, fmtINR, prettyType, statusTone, titleCase, weekdayOf } from "@/lib/train/format";
import { cn } from "@/lib/utils";

export function TrainCard({ t, from, to, date, quota, index }: { t: RouteTrain; from: string; to: string; date: string; quota: string; index: number }) {
  const [openCls, setOpenCls] = useState<string | null>(null);
  const [insight, setInsight] = useState<null | "route" | "live">(null);
  const site = useSite();
  const liveOn = isTrainLiveOn(site);
  const offset = arrivalDayOffset(t.departure_time, t.duration_minutes);
  const runsToday = t.running_days?.includes(weekdayOf(date));
  const altOn = (site.train_alt_seats ?? "on") === "on";
  // no count limit unless Admin turns on "Limit alternate-seat checks"
  const altMax = site.train_alt_limit === "on" ? Math.max(0, parseInt(site.train_alt_auto ?? "2", 10) || 0) : null;
  const cardRef = useRef<HTMLElement>(null);

  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || onScreen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOnScreen(true), { rootMargin: "0px 0px 80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onScreen]);
  const { user } = useAuth();
  const altGuests = (site.train_alt_guests ?? "on") === "on";
  const boardFrom = t.from_station_code || from;
  const alightTo = t.to_station_code || to;
  const classes = t.classes?.length ? t.classes : (t.availability_summary || []).map((a) => a.class_code);
  // one background check per train for all its waitlisted / RAC / regret classes (real % chance + alternate seats)
  const altClasses = classes.filter((c) => {
    const st = t.availability_summary?.find((x) => x.class_code === c)?.status;
    return !!st && ["WAITLIST", "REGRET", "RAC", "NOT_AVAILABLE"].includes(st);
  });
  const alt = useTrainAlternates({
    train: t.train_number, name: t.train_name, from: t.from_station_code || from, to: t.to_station_code || to, date, quota,
    classes: altOn ? altClasses : [], enabled: onScreen && (!!user || altGuests), max: altMax, searchKey: `${from}|${to}|${date}|${quota}`,
  });
  const realChance: Record<string, number | null> = Object.fromEntries(Object.entries(alt).map(([k, v]) => [k, v.own?.chance ?? null]));

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, type: "spring", stiffness: 200, damping: 24 }}
      className="group relative min-w-0 overflow-hidden rounded-3xl border border-line bg-white p-3 shadow-soft transition hover:shadow-[0_20px_50px_-20px_rgba(10,15,31,0.25)] sm:p-5"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-2 opacity-0 transition group-hover:opacity-100" />
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="shrink-0 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] font-bold text-white sm:px-2 sm:text-xs">{t.train_number}</span>
            <h3 className="min-w-0 truncate text-[15px] font-extrabold text-ink sm:text-lg">{titleCase(t.train_name)}</h3>
            <span className="hidden shrink-0 rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-ink/60 sm:inline">{prettyType(t.train_type)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted sm:mt-1.5 sm:gap-3">
            <span className="flex gap-0.5">
              {DAYS.map((d) => (
                <span key={d} className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold sm:h-5 sm:w-5 sm:text-[9px]", t.running_days?.includes(d) ? "bg-brand-soft text-brand" : "text-ink/25")}>{d[0]}</span>
              ))}
            </span>
            {t.has_pantry && <span title="Pantry car" className="flex items-center gap-1 font-semibold"><UtensilsCrossed className="h-3.5 w-3.5" /><span className="hidden sm:inline">Pantry</span></span>}
            {!runsToday && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 sm:text-xs">Doesn&apos;t run on this day</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {t.on_time_rating != null && (
            <span title="On-time rating" className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink sm:text-xs">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {t.on_time_rating.toFixed(1)}
            </span>
          )}
          <div className="flex gap-1">
            <button onClick={() => setInsight(insight === "route" ? null : "route")} aria-label="Route and schedule" className={cn("flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-xs", insight === "route" ? "bg-ink text-white" : "text-ink/70 underline decoration-ink/20 underline-offset-2 hover:bg-surface hover:text-ink sm:no-underline")}>
              <Route className="h-3.5 w-3.5" /> <span>Schedule</span>
            </button>
            {liveOn && (
              <button onClick={() => setInsight(insight === "live" ? null : "live")} aria-label="Live running status" className={cn("flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-xs", insight === "live" ? "bg-ink text-white" : "text-sky-600 hover:bg-sky/10")}>
                <Radio className="h-3.5 w-3.5" /> <span>Live</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:hidden">
        <div className="min-w-0">
          <div className="text-base font-extrabold tabular-nums leading-none text-ink">{t.departure_time}</div>
          <div className="mt-0.5 font-mono text-[10px] font-bold text-muted">{boardFrom}</div>
        </div>
        <div className="relative flex flex-col items-center">
          <span className="text-[10px] font-bold text-ink/60">{fmtDuration(t.duration_minutes)}</span>
          <div className="relative mt-1 h-[2px] w-full bg-[repeating-linear-gradient(90deg,#0a0f1f30_0_5px,transparent_5px_9px)]">
            <span className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full border-2 border-ink bg-white" />
            <span className="absolute -right-0.5 -top-[3px] h-2 w-2 rounded-full bg-ink" />
            <RouteRunner className="-top-[7px] text-brand" duration={2.4}><TrainFront className="h-3.5 w-3.5" /></RouteRunner>
          </div>
          {t.distance_km != null && <span className="mt-1 text-[9px] text-muted">{Math.round(t.distance_km)} km</span>}
        </div>
        <div className="min-w-0 text-right">
          <div className="text-base font-extrabold tabular-nums leading-none text-ink">{t.arrival_time}{offset > 0 && <sup className="ml-0.5 text-[10px] font-bold text-brand">+{offset}</sup>}</div>
          <div className="mt-0.5 font-mono text-[10px] font-bold text-muted">{alightTo}</div>
        </div>
      </div>

      <div className="mt-4 hidden min-w-0 grid-cols-[auto_1fr_auto] items-center gap-4 sm:mt-5 sm:grid">
        <div className="min-w-0">
          <div className="text-xl font-extrabold tabular-nums text-ink sm:text-2xl">{t.departure_time}</div>
          <div className="max-w-full truncate text-[10px] font-semibold text-muted sm:max-w-[160px] sm:text-xs">{titleCase(t.from_station_name) || boardFrom} · <span className="font-mono">{boardFrom}</span></div>
        </div>
        <div className="relative flex flex-col items-center">
          <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-ink/70 sm:text-xs"><Clock className="h-3.5 w-3.5" /> {fmtDuration(t.duration_minutes)}</span>
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
          <div className="text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
            {t.arrival_time}
            {offset > 0 && <sup className="ml-0.5 text-xs font-bold text-brand">+{offset}</sup>}
          </div>
          <div className="max-w-full truncate text-[10px] font-semibold text-muted sm:max-w-[160px] sm:text-xs">{titleCase(t.to_station_name) || alightTo} · <span className="font-mono">{alightTo}</span></div>
        </div>
      </div>

      <ClassRail>
        {classes.map((c) => {
          const a = t.availability_summary?.find((x) => x.class_code === c);
          const pctLow = (a?.status === "WAITLIST" || a?.status === "RAC") && realChance[c] != null && (realChance[c] as number) < 30;
          // under 30% chance: show it as risky (reddish gradient) even though it's technically a waitlist
          const tone = pctLow
            ? { ...statusTone(a?.status), bg: "bg-gradient-to-br from-rose-50 via-red-50 to-red-100", ring: "ring-red-200", text: "text-red-600" }
            : statusTone(a?.status);
          const active = openCls === c;
          const notConfirmed = a && ["WAITLIST", "REGRET", "RAC", "NOT_AVAILABLE"].includes(a.status);
          const pct = realChance[c];
          const chance = (a?.status === "WAITLIST" || a?.status === "RAC") && pct != null ? `${pct}% chance` : null;
          return (
            <div key={c} className="flex w-[30%] min-w-[104px] max-w-[124px] shrink-0 snap-start flex-col sm:w-[148px] sm:max-w-none">
              <span className="mb-0.5 h-3.5 truncate px-0.5 text-[9px] font-medium text-muted sm:mb-1 sm:h-4 sm:px-1 sm:text-[10px]">{a?.last_updated_at ? ago(a.last_updated_at) : ""}</span>
              <button
                onClick={() => setOpenCls(active ? null : c)}
                title={a?.text || tone.label}
                className={cn("relative z-10 rounded-xl p-2 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl sm:p-3", tone.bg, active ? "ring-2 ring-brand" : tone.ring)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-ink sm:text-sm">{c}</span>
                  <span className="text-[10px] font-bold text-ink/70 sm:text-xs">{a?.fare ? fmtINR(a.fare) : ""}</span>
                </div>
                <div className={cn("mt-1 truncate text-[13px] font-extrabold leading-tight sm:mt-1.5 sm:text-[15px]", tone.text)}>{a?.text ? shortStatus(a.text) : tone.label}</div>
                <div className={cn("mt-0.5 truncate text-[9.5px] font-semibold sm:text-[10.5px]", chance ? tone.text : "text-muted")}>{chance || CLASS_NAMES[c] || c}</div>
              </button>
              {notConfirmed && altOn && <AlternateSeatChip data={alt[c]} train={t.train_number} name={t.train_name} from={boardFrom} to={alightTo} date={date} cls={c} quota={quota} />}
            </div>
          );
        })}
      </ClassRail>

      <AnimatePresence>
        {insight && <TrainDrawer train={t.train_number} name={t.train_name} from={boardFrom} to={alightTo} date={date} tab={insight} onClose={() => setInsight(null)} />}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {openCls && <AvailabilityPanel name={titleCase(t.train_name)} train={t.train_number} from={boardFrom} to={alightTo} date={date} cls={openCls} quota={quota} />}
      </AnimatePresence>

    </motion.article>
  );
}

/** One swipeable row of class tiles; arrows appear when there are more classes than fit. */
function ClassRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = ref.current;
    if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const go = (d: number) => ref.current?.scrollBy({ left: d * (ref.current.clientWidth * 0.7), behavior: "smooth" });
  return (
    <div className="relative mt-2.5 sm:mt-5">
      <div
        ref={ref}
        onScroll={measure}
        className={cn(
          "no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto sm:gap-2.5 overflow-y-hidden overscroll-x-contain px-1 pb-2 pt-1",
          edge.right && !edge.left && "[mask-image:linear-gradient(to_right,black_85%,transparent)]",
          edge.left && edge.right && "[mask-image:linear-gradient(to_right,transparent,black_10%,black_88%,transparent)]",
          edge.left && !edge.right && "[mask-image:linear-gradient(to_left,black_85%,transparent)]",
        )}
      >
        {children}
      </div>
      {[-1, 1].map((d) =>
        (d < 0 ? edge.left : edge.right) ? (
          <button
            key={d}
            type="button"
            onClick={() => go(d)}
            aria-label={d < 0 ? "Previous classes" : "More classes"}
            className={cn("absolute top-[46%] z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand shadow-md ring-1 ring-line transition hover:bg-brand hover:text-white sm:h-8 sm:w-8", d < 0 ? "-left-1.5 sm:-left-3" : "-right-1.5 sm:-right-3")}
          >
            {d < 0 ? <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>
        ) : null,
      )}
    </div>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 0) return "";
  return m < 1 ? "Just now" : m < 60 ? `${m} mins ago` : m < 1440 ? `${Math.round(m / 60)} hrs ago` : `${Math.round(m / 1440)} days ago`;
}

/** "GNWL177/WL68" → "WL 68" (current position), "AVAILABLE-0005" → "AVL 5", "RLWL32/WL27" → "WL 27". Full text stays in the tooltip. */
function shortStatus(text: string) {
  const cur = text.split("/").pop()!.trim();
  const avl = cur.match(/^(?:AVAILABLE|AVL)[-\s]*0*(\d+)/i);
  if (avl) return `AVL ${avl[1]}`;
  const wl = cur.match(/^([A-Z]*WL|RAC)\s*0*(\d+)/i);
  if (wl) return `${wl[1].toUpperCase().endsWith("WL") ? "WL" : "RAC"} ${wl[2]}`;
  if (/^REGRET/i.test(cur)) return "Regret";
  if (/^NOT ?AVAILABLE/i.test(cur)) return "Not available";
  return cur.length > 12 ? `${cur.slice(0, 11)}…` : cur;
}
