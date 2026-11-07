"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ExternalLink, Radio, Route, Rows3 } from "lucide-react";
import { trainApi } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { TrainSchedule } from "@/lib/server/train/types";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ScheduleTimeline } from "./schedule-timeline";
import { LiveStatus } from "./live-status";
import { CoachStrip } from "./coach-strip";
import { useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";

type Tab = "route" | "live" | "coach";

/** Inline panel inside a train card: Route (schedule) · Live · Coaches, with "open in new tab". */
export function TrainInsight({ train, from, to, date, initialTab = "route", bare }: { train: string; from: string; to: string; date: string; initialTab?: Tab; bare?: boolean }) {
  const liveOn = isTrainLiveOn(useSite());
  const [tab, setTab] = useState<Tab>(initialTab === "live" && !liveOn ? "route" : initialTab);
  const [sched, setSched] = useState<{ data?: TrainSchedule; error?: string } | null>(null);

  useEffect(() => {
    if (tab !== "route" || sched) return;
    let alive = true;
    trainApi<TrainSchedule>(`/trains/${train}/schedule`, { view: "route" })
      .then((r) => alive && setSched({ data: r.data }))
      .catch((e) => alive && setSched({ error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [tab, sched, train]);

  const href = `/trains/${train}?${new URLSearchParams({ from, to, date, tab: tab === "route" ? "schedule" : tab })}`;
  return (
    <motion.div initial={bare ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="min-w-0 overflow-hidden">
      <div className={bare ? "min-w-0" : "mt-4 min-w-0 rounded-2xl border border-line bg-surface/60 p-4"}>
        <div className={bare ? "sticky top-0 z-10 -mx-5 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white/95 px-5 py-3 backdrop-blur" : "mb-3 flex flex-wrap items-center justify-between gap-2"}>
          <AnimatedTabs
            className="rounded-full bg-white p-1 shadow-soft"
            tabClassName="px-3 py-1.5 text-xs"
            layoutId={`insight-${train}`}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "route", label: "Route", icon: <Route className="h-3.5 w-3.5" /> },
              ...(liveOn ? [{ value: "live" as Tab, label: "Live", icon: <Radio className="h-3.5 w-3.5" /> }] : []),
              { value: "coach", label: "Coaches", icon: <Rows3 className="h-3.5 w-3.5" /> },
            ]}
          />
          <a href={href} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/70 transition hover:border-brand hover:text-brand">
            Open in new tab <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {tab === "route" &&
          (!sched ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 animate-shimmer rounded-lg bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />)}</div>
          ) : sched.error ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-red-600"><AlertTriangle className="h-4 w-4" /> {sched.error}</div>
          ) : (
            <ScheduleTimeline stops={sched.data?.stops || []} from={from} to={to} />
          ))}
        {tab === "live" && liveOn && <LiveStatus train={train} from={from} to={to} compact />}
        {tab === "coach" && <CoachStrip train={train} autoLoad />}
      </div>
    </motion.div>
  );
}
