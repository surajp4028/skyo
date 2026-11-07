"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Armchair, Building2, Crown, IndianRupee, Lock, Radio, RefreshCw, Search, Ticket } from "lucide-react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { LiveFinder } from "./live-finder";
import { StationInput } from "./station-input";
import { trainApi, needsLogin } from "@/lib/train/client";
import { ClientApiError, errMsg } from "@/lib/client/api";
import { parseStationInput } from "@/lib/train/stations";
import type { StationBoard, UnreservedFare, VacantBerthsResponse } from "@/lib/server/train/types";
import { fmtClock, istISO, prettyDate, titleCase } from "@/lib/train/format";
import { useSite } from "@/lib/client/providers";
import { isTrainLiveOn } from "@/lib/services";
import { cn } from "@/lib/utils";

type Tool = "live" | "board" | "berths" | "uts";

export function TrainTools() {
  const site = useSite();
  const liveOn = isTrainLiveOn(site);
  const router = useRouter();
  const sp = useSearchParams();
  const tabs = [
    ...(liveOn ? [{ value: "live" as Tool, label: "Live status", icon: <Radio className="h-4 w-4" /> }, { value: "board" as Tool, label: "Station board", icon: <Building2 className="h-4 w-4" /> }] : []),
    { value: "berths" as Tool, label: "Vacant berths", icon: <Armchair className="h-4 w-4" /> },
    { value: "uts" as Tool, label: "Unreserved fare", icon: <Ticket className="h-4 w-4" /> },
  ];
  const asked = sp.get("tool") as Tool | null;
  const [tool, setToolRaw] = useState<Tool>(tabs.some((t) => t.value === asked) ? (asked as Tool) : tabs[0].value);
  const setTool = (t: Tool) => {
    setToolRaw(t);
    router.replace(`/trains/live?tool=${t}`, { scroll: false });
  };
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex justify-center">
        <AnimatedTabs tabs={tabs} value={tool} onChange={setTool} layoutId="train-tool" className="rounded-full border border-white/40 bg-white/20 p-1 backdrop-blur-md" inactiveTextClassName="text-white/85 hover:text-white" pillClassName="bg-white shadow-lg" activeTextClassName="text-ink" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tool === "live" && <LiveFinder />}
          {tool === "board" && <StationBoardTool />}
          {tool === "berths" && <VacantBerthsTool />}
          {tool === "uts" && <UtsFareTool />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.5)] backdrop-blur-xl">{children}</div>;
}
const goBtn = "flex h-[74px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-6 font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,90,31,0.8)] transition hover:brightness-110 disabled:opacity-60";

function LoginNudge() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-sm font-semibold">
      <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand" /> Log in to use live train tools.</span>
      <a href={`/login?next=${encodeURIComponent("/trains/live")}`} className="rounded-xl bg-ink px-4 py-2 font-bold text-white">Log in</a>
    </div>
  );
}

/* ----------------------------- Station board (4 credits) ----------------------------- */
function StationBoardTool() {
  const [st, setSt] = useState("New Delhi (NDLS)");
  const [win, setWin] = useState<"4" | "8">("4");
  const [r, setR] = useState<{ loading?: boolean; data?: StationBoard; error?: string; login?: boolean } | null>(null);
  const run = () => {
    const code = parseStationInput(st);
    if (!code) return toast.error("Pick a station from the suggestions");
    setR({ loading: true });
    trainApi<StationBoard>(`/stations/${code}/live`, { window_hours: win })
      .then((x) => setR({ data: x.data }))
      .catch((e) => setR({ error: errMsg(e), login: needsLogin(e) }));
  };
  return (
    <Shell>
      <div className="flex flex-col gap-2 md:flex-row">
        <StationInput label="Station" value={st} onChange={(l) => setSt(l)} />
        <div className="flex items-center gap-1 rounded-2xl border border-line p-1.5">
          {(["4", "8"] as const).map((w) => (
            <button key={w} onClick={() => setWin(w)} className={cn("h-full rounded-xl px-4 text-sm font-bold", win === w ? "bg-ink text-white" : "text-ink/60")}>Next {w}h</button>
          ))}
        </div>
        <button onClick={run} disabled={r?.loading} className={goBtn}>{r?.loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />} Show trains</button>
      </div>
      {r?.login && <LoginNudge />}
      {r?.error && !r.login && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{r.error}</p>}
      {r?.data && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr className="border-b border-line"><th className="py-2">Train</th><th>Arrives</th><th>Departs</th><th>PF</th><th>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.data.trains.map((t, i) => {
                const dl = t.departure_delay_minutes ?? t.arrival_delay_minutes;
                return (
                  <motion.tr key={`${t.train_number}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }}>
                    <td className="py-2.5"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{t.train_number}</span><span className="font-bold">{titleCase(t.train_name)}</span><div className="text-xs text-muted">{titleCase(t.source_station_name)} → {titleCase(t.destination_station_name)}</div></td>
                    <td className="font-semibold tabular-nums">{fmtClock(t.estimated_arrival || t.scheduled_arrival)}</td>
                    <td className="font-semibold tabular-nums">{fmtClock(t.estimated_departure || t.scheduled_departure)}</td>
                    <td>{t.platform_number ? <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold">{t.platform_number}</span> : "—"}</td>
                    <td><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", dl == null ? "bg-slate-100 text-slate-600" : dl <= 5 ? "bg-emerald-50 text-emerald-700" : dl <= 30 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>{t.status === "CANCELLED" ? "Cancelled" : dl == null ? t.status.replace(/_/g, " ").toLowerCase() : dl <= 0 ? "On time" : `+${dl}m`}</span></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {r.data.trains.length === 0 && <p className="py-6 text-center text-sm text-muted">No trains in this window.</p>}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------- Vacant berths (Scale plan) ------------------------- */
function VacantBerthsTool() {
  const [train, setTrain] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(istISO(0));
  const [r, setR] = useState<{ loading?: boolean; data?: VacantBerthsResponse; error?: string; locked?: boolean; login?: boolean } | null>(null);
  const run = () => {
    const f = parseStationInput(from);
    const t = parseStationInput(to);
    if (!/^\d{4,5}$/.test(train) || !f || !t) return toast.error("Enter train number and pick both stations");
    setR({ loading: true });
    trainApi<VacantBerthsResponse>("/charts/vacant-berths", { train, from: f, to: t, date })
      .then((x) => setR({ data: x.data }))
      .catch((e) => setR({ error: errMsg(e), login: needsLogin(e), locked: e instanceof ClientApiError && e.info.code === "PLAN_REQUIRED" }));
  };
  const byCoach = r?.data ? Object.entries(r.data.vacant_berths.reduce<Record<string, VacantBerthsResponse["vacant_berths"]>>((a, b) => ((a[b.coach_name] ||= []).push(b), a), {})) : [];
  return (
    <Shell>
      <p className="mb-4 text-sm text-muted">After the chart is prepared, find empty berths you can book at the station — even on a “full” train.</p>
      <div className="grid gap-2 md:grid-cols-[150px_1fr_1fr]">
        <label className="flex flex-col rounded-2xl border border-line px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Train no.</span>
          <input value={train} onChange={(e) => setTrain(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="12952" className="mt-1 bg-transparent text-[17px] font-bold outline-none" />
        </label>
        <StationInput label="From" value={from} onChange={(l) => setFrom(l)} />
        <StationInput label="To" value={to} onChange={(l) => setTo(l)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[0, 1].map((o) => (
          <button key={o} onClick={() => setDate(istISO(o))} className={cn("rounded-xl border px-3 py-2 text-xs font-bold", date === istISO(o) ? "border-ink bg-ink text-white" : "border-line text-ink/70")}>{o === 0 ? "Today" : "Tomorrow"}</button>
        ))}
        <button onClick={run} disabled={r?.loading} className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">{r?.loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find vacant berths</button>
      </div>
      {r?.locked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mt-5 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#0a0f1f,#2a1a3f)] p-5 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/25 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300"><Crown className="h-5 w-5" /></span>
            <div>
              <div className="font-extrabold">Premium feature</div>
              <p className="mt-1 text-sm text-white/70">Chart & vacant-berth data needs the RailCore <b>Scale</b> plan. It&apos;s fully built in SKYO and switches on automatically when the plan is upgraded (set <code className="rounded bg-white/10 px-1">RK_PLAN=scale</code>).</p>
            </div>
          </div>
        </motion.div>
      )}
      {r?.login && <LoginNudge />}
      {r?.error && !r.locked && !r.login && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{r.error}</p>}
      {r?.data && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className={cn("rounded-full px-3 py-1", r.data.chart_status.chart_one_prepared ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>Chart 1 {r.data.chart_status.chart_one_prepared ? "prepared" : "pending"}</span>
            <span className={cn("rounded-full px-3 py-1", r.data.chart_status.chart_two_prepared ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>Chart 2 {r.data.chart_status.chart_two_prepared ? "prepared" : "pending"}</span>
          </div>
          {byCoach.length === 0 && <p className="text-sm text-muted">No vacant berths on this segment right now.</p>}
          {byCoach.map(([coach, berths]) => (
            <div key={coach}>
              <div className="mb-1.5 text-sm font-extrabold">{coach} <span className="text-xs font-semibold text-muted">· {berths[0].class_code} · {berths.length} vacant</span></div>
              <div className="flex flex-wrap gap-1.5">
                {berths.map((b, i) => (
                  <span key={i} title={`${b.from_station_code} → ${b.to_station_code}`} className={cn("rounded-lg px-2 py-1 text-xs font-bold", b.covers_requested_segment ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200")}>
                    {b.berth_number} {b.berth_code}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ----------------------------- Unreserved / UTS fare (3 credits) ----------------------------- */
function UtsFareTool() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cls, setCls] = useState<"II" | "FC">("II");
  const [tt, setTt] = useState<"O" | "E" | "S">("O");
  const [ticket, setTicket] = useState<"J" | "M" | "Q">("J");
  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [r, setR] = useState<{ loading?: boolean; data?: UnreservedFare; error?: string } | null>(null);
  const run = () => {
    const f = parseStationInput(from);
    const t = parseStationInput(to);
    if (!f || !t) return toast.error("Pick both stations from the suggestions");
    setR({ loading: true });
    trainApi<UnreservedFare>("/fares/unreserved", { from: f, to: t, class: cls, train_type: tt, ticket_type: ticket, adult, child })
      .then((x) => setR({ data: x.data }))
      .catch((e) => setR({ error: errMsg(e) }));
  };
  return (
    <Shell>
      <p className="mb-4 text-sm text-muted">General-class (UTS) journey and season-ticket fares — for local and unreserved travel.</p>
      <div className="flex flex-col gap-2 md:flex-row">
        <StationInput label="From" value={from} onChange={(l) => setFrom(l)} />
        <StationInput label="To" value={to} onChange={(l) => setTo(l)} />
        <button onClick={run} disabled={r?.loading} className={goBtn}>{r?.loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <IndianRupee className="h-5 w-5" />} Get fare</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Seg v={cls} set={setCls} opts={[["II", "Second class"], ["FC", "First class"]]} />
        <Seg v={tt} set={setTt} opts={[["O", "Ordinary"], ["E", "Express"], ["S", "Superfast"]]} />
        <Seg v={ticket} set={setTicket} opts={[["J", "Journey"], ["M", "Monthly"], ["Q", "Quarterly"]]} />
        <span className="flex items-center gap-2 text-xs font-bold">Adults <Counter v={adult} set={setAdult} min={1} /> Children <Counter v={child} set={setChild} min={0} /></span>
      </div>
      {r?.error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{r.error}</p>}
      {r?.data && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {r.data.routes.map((x, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-2xl border border-line p-4">
              <span className="text-sm font-semibold text-ink/80">{x.route}</span>
              <span className="text-xl font-extrabold">₹{Number(x.fare).toLocaleString("en-IN")}</span>
            </motion.div>
          ))}
          {r.data.routes.length === 0 && <p className="text-sm text-muted">No fare found for this pair.</p>}
          <p className="text-[11px] text-muted sm:col-span-2">Fare for {prettyDate(r.data.date || istISO(1))} · Live data by RailCore</p>
        </div>
      )}
    </Shell>
  );
}

function Seg<T extends string>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {opts.map(([k, l]) => <button key={k} onClick={() => set(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", v === k ? "bg-white text-ink shadow" : "text-ink/55")}>{l}</button>)}
    </div>
  );
}

function Counter({ v, set, min }: { v: number; set: (n: number) => void; min: number }) {
  return (
    <span className="flex items-center gap-1 rounded-lg bg-surface px-1">
      <button onClick={() => set(Math.max(min, v - 1))} className="h-6 w-6 font-bold">−</button>
      <span className="w-4 text-center">{v}</span>
      <button onClick={() => set(Math.min(9, v + 1))} className="h-6 w-6 font-bold">+</button>
    </span>
  );
}
