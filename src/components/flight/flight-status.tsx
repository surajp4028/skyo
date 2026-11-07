"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Database, Gauge, Loader2, Mountain, Navigation, Radar, Search } from "lucide-react";
import { api, ClientApiError, errMsg } from "@/lib/client/api";
import { RouteMap } from "./route-map";
import { AirlineLogo } from "./airline-logo";
import { cn, timeAgo } from "@/lib/utils";

type Live = {
  flight: string; date: string; status: string; airline: { iata: string; name: string };
  dep: { iata: string; airport: string; city: string; terminal: string | null; gate: string | null; scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null };
  arr: { iata: string; airport: string; city: string; terminal: string | null; gate: string | null; baggage: string | null; scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null };
  live: { lat: number; lon: number; altitude: number; speed: number; direction: number; isGround: boolean; updated: string } | null;
  aircraft: { registration: string | null; icao: string | null } | null;
  fetchedAt: string; cached: boolean;
};
const TONE: Record<string, [string, string]> = {
  scheduled: ["Scheduled", "bg-sky-100 text-sky-700"], active: ["In the air", "bg-emerald-100 text-emerald-700"], landed: ["Landed", "bg-indigo-100 text-indigo-700"],
  cancelled: ["Cancelled", "bg-red-100 text-red-700"], diverted: ["Diverted", "bg-amber-100 text-amber-700"], incident: ["Incident", "bg-red-100 text-red-700"],
};
const mins = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** Live flight status (aviationstack real-time). One lookup per flight is cached for everyone. */
export function FlightStatus() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = (sp.get("flight") || "").toUpperCase();
  const [code, setCode] = useState(initial);
  const [state, setState] = useState<{ key: string; data?: Live; at?: number; error?: string; login?: boolean } | null>(null);
  const loading = !!initial && (!state || state.key !== initial);

  useEffect(() => {
    if (!initial) return;
    let alive = true;
    api<{ status: Live }>(`/api/flight/status?flight=${encodeURIComponent(initial)}`)
      .then((r) => alive && setState({ key: initial, data: r.status, at: Date.now() }))
      .catch((e) => alive && setState({ key: initial, error: errMsg(e), login: e instanceof ClientApiError && e.status === 401 }));
    return () => {
      alive = false;
    };
  }, [initial]);

  const d = state?.key === initial ? state.data : undefined;
  const dep = d ? mins(d.dep.actual || d.dep.estimated || d.dep.scheduled) : null;
  const arr = d ? mins(d.arr.estimated || d.arr.scheduled) : null;
  const nowIst = state?.at ? mins(new Date(state.at + 5.5 * 3600_000).toISOString().slice(11, 16)) : null;
  const progress = d?.status === "landed" ? 1 : d?.status === "active" && dep != null && arr != null && nowIst != null ? Math.min(0.97, Math.max(0.03, (nowIst - dep) / ((arr < dep ? arr + 1440 : arr) - dep))) : d?.status === "scheduled" ? 0 : null;
  const [label, tone] = d ? TONE[d.status] || [d.status, "bg-surface text-ink"] : ["", ""];

  return (
    <div>
      <section className="relative -mt-20 overflow-hidden pb-16 pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,#1e40af_0%,#0b1020_60%,#050816_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.25),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 text-white sm:px-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur"><Radar className="h-3.5 w-3.5" /> Live flight status</span>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Where&apos;s my flight?</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">Departure, arrival, terminals, gates, delays and the plane&apos;s live position — for flights operating today.</p>
          <form onSubmit={(e) => (e.preventDefault(), code.trim() && router.push(`/flights/status?flight=${encodeURIComponent(code.replace(/\s+/g, "").toUpperCase())}`))} className="mt-6 flex max-w-xl gap-2 rounded-2xl bg-white/10 p-2 ring-1 ring-white/15 backdrop-blur">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} placeholder="Flight number, e.g. 6E 395" className="min-w-0 flex-1 bg-transparent px-3 text-lg font-bold tracking-wider text-white outline-none placeholder:text-white/40" />
            <button className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-ink"><Search className="h-4 w-4" /> Track</button>
          </form>
        </div>
      </section>

      <div className="relative mx-auto -mt-8 max-w-5xl px-4 pb-20 sm:px-5">
        {!initial ? (
          <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-soft"><p className="text-sm text-muted">Enter a flight number to see its live status. You can also track booked flights from <Link href="/account?tab=trips" className="font-bold text-[#0057ff]">My trips</Link>.</p></div>
        ) : loading ? (
          <div className="flex flex-col items-center rounded-3xl border border-line bg-white p-12 shadow-soft"><Loader2 className="h-8 w-8 animate-spin text-[#0057ff]" /><p className="mt-3 text-sm font-semibold text-muted">Finding {initial}…</p></div>
        ) : state?.error ? (
          <div className="rounded-3xl border border-line bg-white p-10 text-center shadow-soft">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 font-bold">{state.error}</p>
            {state.login && <Link href={`/login?next=${encodeURIComponent(`/flights/status?flight=${initial}`)}`} className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Log in</Link>}
          </div>
        ) : d ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[28px] border border-line bg-white shadow-lift">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
              <AirlineLogo iata={d.airline.iata} size={44} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold">{d.airline.name} · {d.flight.slice(0, 2)} {d.flight.slice(2)}</div>
                <div className="text-xs text-muted">{d.date}{d.aircraft?.registration ? ` · ${d.aircraft.registration}` : ""}{d.aircraft?.icao ? ` · ${d.aircraft.icao}` : ""}</div>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-sm font-extrabold", tone)}>{label}</span>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                  <Side title="Departure" p={d.dep} />
                  <ArrowRight className="mt-8 h-6 w-6 text-muted" />
                  <Side title="Arrival" p={d.arr} right />
                </div>
                {progress != null && (
                  <div className="mt-6">
                    <div className="relative h-2 rounded-full bg-surface">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1.2 }} className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-[#0057ff]" />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] font-bold text-muted"><span>{d.dep.iata}</span><span>{Math.round(progress * 100)}% of the journey</span><span>{d.arr.iata}</span></div>
                  </div>
                )}
                {d.live && (
                  <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                    <Stat icon={<Mountain className="h-4 w-4" />} k="Altitude" v={`${d.live.altitude.toLocaleString("en-IN")} m`} />
                    <Stat icon={<Gauge className="h-4 w-4" />} k="Speed" v={`${d.live.speed} km/h`} />
                    <Stat icon={<Navigation className="h-4 w-4" />} k="Heading" v={`${d.live.direction}°`} />
                  </div>
                )}
                <p className="mt-5 flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Database className="h-3.5 w-3.5" /> aviationstack real-time · {d.cached ? `cached ${timeAgo(d.fetchedAt)}` : "just updated"} · times are local airport time</p>
              </div>
              <div className="bg-[radial-gradient(120%_80%_at_0%_0%,#1e3a8a_0%,#0b1020_60%)] p-4">
                <RouteMap codes={[d.dep.iata, d.arr.iata]} live={d.live ? { lat: d.live.lat, lon: d.live.lon, direction: d.live.direction } : null} progress={d.live ? null : progress} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function Side({ title, p, right }: { title: string; p: Live["dep"] & { baggage?: string | null }; right?: boolean }) {
  const late = (p.delay ?? 0) > 0;
  return (
    <div className={right ? "text-right" : ""}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className="mt-1 text-3xl font-black tabular-nums">{p.actual || p.estimated || p.scheduled || "—"}</div>
      {(p.actual || p.estimated) && p.scheduled && (p.actual || p.estimated) !== p.scheduled && <div className="text-xs font-semibold text-muted line-through">{p.scheduled}</div>}
      <div className="mt-1 text-sm font-extrabold">{p.city} ({p.iata})</div>
      <div className="text-[11px] text-muted">{p.airport}</div>
      <div className={cn("mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold", right && "justify-end")}>
        <span className="rounded-md bg-surface px-2 py-0.5">Terminal {p.terminal || "–"}</span>
        <span className="rounded-md bg-surface px-2 py-0.5">Gate {p.gate || "–"}</span>
        {p.baggage && <span className="rounded-md bg-surface px-2 py-0.5">Belt {p.baggage}</span>}
        {late && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">+{p.delay} min</span>}
      </div>
    </div>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <div className="flex items-center gap-1 text-muted">{icon}{k}</div>
      <div className="mt-1 text-base font-extrabold">{v}</div>
    </div>
  );
}
