"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CalendarDays, MapPinned, Radio, Route, Rows3, Timer, UtensilsCrossed } from "lucide-react";
import { trainApi } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { LiveTrainStatus, TrainSchedule } from "@/lib/server/train/types";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { ScheduleTimeline } from "./schedule-timeline";
import { LiveStatus } from "./live-status";
import { CoachStrip } from "./coach-strip";
import { TrainLoader } from "./train-loader";
import { DAYS, fmtDuration, istISO, titleCase, toMinutes } from "@/lib/train/format";
import { useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";
import { cn } from "@/lib/utils";

/** Full train page: route (scrollable, tracing beam) on the left; live status + coaches pinned on the right. */
export function TrainDetail({ number, from, to, tab }: { number: string; from?: string; to?: string; date?: string; tab?: string }) {
  const liveOn = isTrainLiveOn(useSite());
  const [s, setS] = useState<{ data?: TrainSchedule; error?: string } | null>(null);
  const routeBox = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<LiveTrainStatus | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    trainApi<TrainSchedule>(`/trains/${number}/schedule`, { view: "route" })
      .then((r) => alive && setS({ data: r.data }))
      .catch((e) => alive && setS({ error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [number]);

  const d = s?.data;

  // Where is the train on the scheduled route? → the last scheduled stop it has reached.
  const trainAt = (() => {
    if (!live || !d) return null;
    const reached = new Set(live.stations.filter((x) => x.has_arrived || x.has_departed || x.travelled).map((x) => x.station_code));
    const atCode = live.current_station_code;
    const atRow = atCode ? d.stops.find((x) => x.station_code === atCode) : undefined;
    if (atRow) return { code: atRow.station_code, label: live.status === "AT_STATION" ? "TRAIN HERE" : atRow.is_stop === false ? "PASSING" : "LAST SEEN" };
    const last = [...d.stops].reverse().find((x) => reached.has(x.station_code));
    if (!last) return live.status === "NOT_STARTED" ? { code: d.stops[0].station_code, label: "NOT STARTED" } : null;
    return { code: last.station_code, label: last.station_code === d.stops[d.stops.length - 1].station_code ? "ARRIVED" : "PASSED" };
  })();

  // Pick the run that is most likely on the move right now (decided from the timetable — no API call).
  const liveDate = (() => {
    if (!d) return istISO(0);
    const dep = toMinutes(d.stops[0]?.departure_time) ?? 0;
    const dur = d.total_duration_minutes ?? 0;
    const nowIst = new Date(now + 5.5 * 3600_000);
    const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
    if (nowMin < dep && nowMin + 1440 < dep + dur + 60) return istISO(-1); // yesterday's run still travelling
    if (nowMin < dep && nowMin + 2880 < dep + dur + 60) return istISO(-2);
    return istISO(0);
  })();

  // Auto-scroll the route panel to the train's position.
  useEffect(() => {
    if (!trainAt || !routeBox.current) return;
    const row = routeBox.current.querySelector<HTMLElement>(`[data-code="${trainAt.code}"]`);
    if (row) routeBox.current.scrollTo({ top: Math.max(0, row.offsetTop - routeBox.current.clientHeight / 2.5), behavior: "smooth" });
  }, [trainAt?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <section className="relative -mt-20 overflow-hidden pb-20 pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0057ff_0%,#1a82ff_55%,#6cbcff_100%)]" />
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85),transparent_65%)]" />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto max-w-7xl px-5 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white/20 px-2.5 py-1 font-mono text-sm font-bold backdrop-blur">{number}</span>
            <h1 className="text-2xl font-extrabold md:text-3xl">{d ? titleCase(d.train_name) : "Train details"}</h1>
          </div>
          {d && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <Chip icon={<Route className="h-3.5 w-3.5" />}>{d.source_station_code} → {d.destination_station_code}</Chip>
              <Chip icon={<Timer className="h-3.5 w-3.5" />}>{fmtDuration(d.total_duration_minutes)}</Chip>
              {d.distance_km && <Chip icon={<MapPinned className="h-3.5 w-3.5" />}>{Math.round(d.distance_km)} km</Chip>}
              {d.rake_type && <Chip>{d.rake_type} rake</Chip>}
              {d.pantry && <Chip icon={<UtensilsCrossed className="h-3.5 w-3.5" />}>Pantry</Chip>}
              <Chip icon={<CalendarDays className="h-3.5 w-3.5" />}>
                {DAYS.map((x) => <span key={x} className={cn("mx-[1px]", d.running_days.includes(x) ? "text-white" : "text-white/35")}>{x[0]}</span>)}
              </Chip>
            </div>
          )}
        </motion.div>
      </section>

      <div className="relative z-10 mx-auto -mt-14 grid max-w-7xl gap-5 px-5 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel title="Route" icon={<Route className="h-4 w-4" />} subtitle={d ? `${d.stops.filter((x) => x.is_stop !== false).length} halts · ${d.stops.filter((x) => x.is_stop === false).length} intermediate` : undefined}>
          <div ref={routeBox} className="no-scrollbar relative max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {!s ? <TrainLoader label="Loading route…" /> : s.error ? (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> {s.error}</div>
            ) : (
              <TracingBeam container={routeBox}>
                <ScheduleTimeline stops={d?.stops || []} from={from} to={to} collapsible={false} trainAt={trainAt} />
              </TracingBeam>
            )}
          </div>
        </Panel>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          {liveOn && (
            <Panel title="Live running status" icon={<Radio className="h-4 w-4" />}>
              {s ? (
                <LiveStatus key={liveDate} train={number} initialDate={liveDate} from={from} to={to} autoLoad compact onData={setLive} />
              ) : (
                <div className="h-28 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />
              )}
            </Panel>
          )}
          <Panel title="Coach position" icon={<Rows3 className="h-4 w-4" />}>
            <CoachStrip train={number} autoLoad={tab === "coach"} />
          </Panel>
        </div>
      </div>
      <p className="pb-10 text-center text-[11px] text-muted">Live data by RailCore · Not affiliated with IRCTC / Indian Railways · Verify before travel</p>
    </div>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">{icon}{children}</span>;
}

function Panel({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 rounded-3xl border border-line bg-white p-5 shadow-[0_24px_60px_-28px_rgba(10,15,31,0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white">{icon}</span>{title}</h2>
        {subtitle && <span className="text-xs font-semibold text-muted">{subtitle}</span>}
      </div>
      {children}
    </motion.section>
  );
}
