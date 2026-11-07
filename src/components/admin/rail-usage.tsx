"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/client/api";
import { Gauge, Settings2, TrainFront, Zap } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Card } from "./ui";
import { useAdmin } from "./admin-context";
import { cn } from "@/lib/utils";

type Usage = {
  plan: string; enabled: boolean; devSingle: boolean; dailyCap: number; today: number; balance: number | null; dayRequestsRemaining: number | null;
  month: { credits: number; calls: number; errors: number }; byOperation: { operation: string; calls: number; credits: number; avg_ms: number | null }[];
  daily: { date: string; credits: number }[];
};

const OP_LABEL: Record<string, string> = {
  "routes.trains": "Trains between", "availability.seats": "Seat availability", "availability.calendar": "Availability calendar", "trains.live": "Live status",
  "trains.schedule": "Schedule", "stations.search": "Station search", "trains.search": "Train search", "trains.coach": "Coach position", "fares.estimate": "Fare estimate",
};

/** RailCore credit meter: today vs. daily cap (radial), account balance, top operations. */
export function RailUsage({ compact }: { compact?: boolean }) {
  const admin = useAdmin();
  const { data, reload } = useFetch<Usage>("/api/admin/train-usage");
  const [busy, setBusy] = useState(false);
  const flipDev = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", body: { train_dev_single_result: data.devSingle ? "off" : "on" } });
      toast.success(data.devSingle ? "Search now shows all trains" : "Search limited to 1 train (dev)");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const pct = data ? Math.min(100, (data.today / Math.max(1, data.dailyCap)) * 100) : 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <Card className={cn("relative overflow-hidden p-5", compact && "p-4")}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky/15 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold"><TrainFront className="h-4 w-4 text-brand" /> RailCore credits</div>
          <div className="text-xs text-muted">Live train data · {data ? `${data.plan} plan` : "…"} {data && !data.enabled && <span className="font-bold text-red-600">· paused</span>}</div>
        </div>
        <div className="flex items-center gap-2">
          {admin.can("settings.manage") && data && (
            <button onClick={flipDev} disabled={busy} title="Dev setting: limit train search to 1 result to save credits" className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50", data.devSingle ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
              <span className={cn("relative h-4 w-7 rounded-full transition", data.devSingle ? "bg-amber-400" : "bg-emerald-500")}><span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", data.devSingle ? "left-0.5" : "left-3.5")} /></span>
              {data.devSingle ? "Search: 1 train (dev)" : "Search: all trains"}
            </button>
          )}
          {admin.can("settings.manage") && <Link href="/admin/settings?tab=train" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" title="Daily cap & kill switch"><Settings2 className="h-4 w-4" /></Link>}
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#eef0f6" strokeWidth="10" />
            <motion.circle cx="50" cy="50" r={R} fill="none" strokeLinecap="round" strokeWidth="10" stroke="url(#rail-g)" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - (pct / 100) * C }} transition={{ duration: 1.1, ease: "easeOut" }} />
            <defs><linearGradient id="rail-g" x1="0" x2="1"><stop offset="0" stopColor="#ff5a1f" /><stop offset="1" stopColor="#ffb36b" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full text-center">
            <span className="text-xl font-extrabold leading-none tabular-nums">{data?.today ?? "—"}</span>
            <span className="mt-1 text-[9px] font-bold uppercase leading-tight tracking-wide text-muted">of {data?.dailyCap ?? "—"}<br />today</span>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
          <Mini icon={<Zap className="h-3.5 w-3.5" />} label="Balance" value={data?.balance ?? "—"} />
          <Mini icon={<Gauge className="h-3.5 w-3.5" />} label="This month" value={data?.month.credits ?? "—"} />
          <Mini label="Calls (month)" value={data?.month.calls ?? "—"} />
          <Mini label="Requests left today" value={data?.dayRequestsRemaining ?? "—"} />
        </div>
      </div>
      {!compact && data && data.byOperation.length > 0 && (
        <div className="relative mt-5 space-y-2">
          {data.byOperation.slice(0, 5).map((o) => {
            const w = (o.credits / Math.max(1, data.byOperation[0].credits)) * 100;
            return (
              <div key={o.operation}>
                <div className="flex justify-between text-[11px] font-semibold"><span>{OP_LABEL[o.operation] || o.operation}</span><span className="text-muted">{o.credits} cr · {o.calls} calls{o.avg_ms ? ` · ${o.avg_ms}ms` : ""}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface"><motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" /></div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Mini({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface/80 p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">{icon}{label}</div>
      <div className="mt-0.5 text-base font-extrabold tabular-nums text-ink">{value}</div>
    </div>
  );
}
