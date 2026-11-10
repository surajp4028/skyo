"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, Database, Loader2, PlaneLanding, PlaneTakeoff, Search } from "lucide-react";
import { api, ClientApiError, errMsg } from "@/lib/client/api";
import { AirportInput } from "./airport-input";
import { AirlineLogo } from "./airline-logo";
import { SkyHero } from "./sky-hero";
import { parseAirportInput } from "@/lib/flight/airports";
import { cn, timeAgo } from "@/lib/utils";

type Row = {
  flight: string; airline: { iata: string; name: string }; codeshares: string[]; other: { iata: string; city: string };
  scheduled: string | null; estimated: string | null; actual: string | null; delay: number | null;
  terminal: string | null; gate: string | null; baggage: string | null; status: string;
};
type Board = { airport: { iata: string; city: string; name: string }; type: "departure" | "arrival"; rows: Row[]; fetchedAt: string; cached: boolean; total: number | null };

const STATUS: Record<string, [string, string]> = {
  scheduled: ["Scheduled", "text-sky-300"], active: ["In the air", "text-emerald-300"], landed: ["Landed", "text-indigo-300"],
  cancelled: ["Cancelled", "text-red-400"], diverted: ["Diverted", "text-amber-300"], incident: ["Incident", "text-red-400"],
};

/** Today's departures / arrivals at one airport, airport-board style. */
export function AirportBoard() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();
  const type = sp.get("type") === "arrival" ? "arrival" : "departure";
  const [label, setLabel] = useState(code ? code : "");
  const [q, setQ] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const key = `${code}|${type}`;
  const [state, setState] = useState<{ key: string; data?: Board; at?: number; error?: string; login?: boolean } | null>(null);
  const loading = !!code && (!state || state.key !== key);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    api<{ board: Board }>(`/api/flight/board?${new URLSearchParams({ code, type })}`)
      .then((r) => alive && (setState({ key, data: r.board, at: Date.now() }), setLabel(`${r.board.airport.city} (${r.board.airport.iata})`)))
      .catch((e) => alive && setState({ key, error: errMsg(e), login: e instanceof ClientApiError && e.status === 401 }));
    return () => {
      alive = false;
    };
  }, [key, code, type]);

  const go = (c: string, t: string) => router.push(`/flights/airport?${new URLSearchParams({ code: c, type: t })}`);
  const d = state?.key === key ? state.data : undefined;
  // like a real board: start from "now" (airport local time) — earlier flights behind a toggle
  // aviationstack times are the airport's local time; boards are Indian airports first, so "now" is IST
  const at = state?.key === key ? state.at : undefined;
  const nowMin = at ? (() => {
    const t = new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
    return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  })() : null;
  const minOf = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
  const earlierCount = useMemo(() => (nowMin === null ? 0 : (d?.rows || []).filter((r) => (minOf(r.actual || r.estimated || r.scheduled) ?? 9999) < nowMin - 30).length), [d, nowMin]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (d?.rows || []).filter((r) => (earlier || nowMin === null || (minOf(r.actual || r.estimated || r.scheduled) ?? 9999) >= nowMin - 30) && (!delayedOnly || (r.delay ?? 0) >= 15 || r.status === "cancelled") && (!s || `${r.flight} ${r.airline.name} ${r.other.city} ${r.other.iata}`.toLowerCase().includes(s)));
  }, [d, q, delayedOnly, earlier, nowMin]);

  return (
    <div>
      <SkyHero compact>
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            Airport live board
          </span>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-[0_6px_30px_rgba(10,40,120,0.35)] md:text-5xl">Departures & arrivals, live.</h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 md:text-base">Today&apos;s flights at an airport — times, terminal, gate, baggage belt and delays.</p>
          <form onSubmit={(e) => (e.preventDefault(), parseAirportInput(label) && go(parseAirportInput(label)!, type))} className="mt-5 flex max-w-2xl flex-col gap-2 rounded-[22px] bg-white p-2 shadow-[0_30px_80px_-24px_rgba(10,30,90,0.55)] sm:flex-row sm:items-stretch">
            <AirportInput label="Airport" kind={type === "departure" ? "from" : "to"} value={label} onChange={(l, c) => (setLabel(l), c && go(c, type))} className="[&_label]:border-0" />
            <button className="flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-extrabold text-white"><Search className="h-4 w-4" /> Show board</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            {["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "GOI", "DXB"].map((c) => (
              <button key={c} type="button" onClick={() => go(c, type)} className={cn("rounded-full border px-3 py-1.5 backdrop-blur transition", c === code ? "border-white bg-white text-[#0057ff]" : "border-white/40 bg-white/15 text-white hover:bg-white hover:text-[#0057ff]")}>{c}</button>
            ))}
          </div>
        </div>
      </SkyHero>

      <div className="relative z-20 mx-auto -mt-28 max-w-6xl px-4 pb-20 sm:px-5">
        <div className="overflow-hidden rounded-[28px] bg-[#0b1020] text-white shadow-lift ring-1 ring-white/10">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex rounded-2xl bg-white/5 p-1">
              {(["departure", "arrival"] as const).map((t) => (
                <button key={t} onClick={() => code && go(code, t)} className={cn("relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold transition", type === t ? "text-ink" : "text-white/60 hover:text-white")}>
                  {type === t && <motion.span layoutId="board-tab" className="absolute inset-0 rounded-xl bg-amber-300" />}
                  <span className="relative flex items-center gap-1.5">{t === "departure" ? <PlaneTakeoff className="h-4 w-4" /> : <PlaneLanding className="h-4 w-4" />}{t === "departure" ? "Departures" : "Arrivals"}</span>
                </button>
              ))}
            </div>
            {d && <div className="min-w-0"><div className="truncate font-mono text-lg font-black tracking-widest text-amber-300">{d.airport.iata} · {d.airport.city.toUpperCase()}</div><div className="truncate text-[11px] text-white/50">{d.airport.name}</div></div>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Flight, airline or city" className="h-9 w-48 rounded-xl bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
              <label className="flex items-center gap-1.5 text-xs font-bold text-white/70"><input type="checkbox" checked={delayedOnly} onChange={(e) => setDelayedOnly(e.target.checked)} className="accent-amber-300" /> Delayed only</label>
              {earlierCount > 0 && <label className="flex items-center gap-1.5 text-xs font-bold text-white/70"><input type="checkbox" checked={earlier} onChange={(e) => setEarlier(e.target.checked)} className="accent-amber-300" /> Earlier ({earlierCount})</label>}
            </div>
          </div>

          {!code ? (
            <p className="px-6 py-16 text-center text-sm text-white/60">Pick an airport to see today&apos;s board.</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-white/60"><Loader2 className="h-5 w-5 animate-spin" /> Loading the board…</div>
          ) : state?.error ? (
            <div className="px-6 py-14 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-amber-300" />
              <p className="mt-2 font-bold">{state.error}</p>
              {state.login && <Link href={`/login?next=${encodeURIComponent(`/flights/airport?code=${code}&type=${type}`)}`} className="mt-4 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-ink">Log in</Link>}
            </div>
          ) : d ? (
            <>
              <div className="hidden grid-cols-[80px_1.3fr_1.2fr_70px_80px_1fr] gap-3 border-b border-white/10 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/40 md:grid">
                <span>Time</span><span>Flight</span><span>{type === "departure" ? "To" : "From"}</span><span>Terminal</span><span>{type === "departure" ? "Gate" : "Belt"}</span><span>Status</span>
              </div>
              <ul className="max-h-[70vh] divide-y divide-white/5 overflow-y-auto overscroll-contain">
                {rows.length === 0 && <li className="px-5 py-12 text-center text-sm text-white/50">No flights match.</li>}
                {rows.map((r, i) => {
                  const [label2, tone] = STATUS[r.status] || [r.status, "text-white/70"];
                  const late = (r.delay ?? 0) >= 15;
                  const shown = r.actual || r.estimated || r.scheduled;
                  return (
                    <li key={`${r.flight}-${i}`}>
                      <Link href={`/flights/status?flight=${r.flight.replace(" ", "")}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-5 py-3 transition hover:bg-white/5 md:grid-cols-[80px_1.3fr_1.2fr_70px_80px_1fr]">
                        <span className="font-mono">
                          <span className={cn("block text-lg font-black tabular-nums", late ? "text-amber-300" : "text-white")}>{shown || "—"}</span>
                          {late && r.scheduled && shown !== r.scheduled && <span className="block text-[11px] text-white/40 line-through">{r.scheduled}</span>}
                        </span>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <AirlineLogo iata={r.airline.iata} size={30} className="rounded-lg" />
                          <span className="min-w-0">
                            <span className="block font-mono text-sm font-extrabold tracking-wider">{r.flight}</span>
                            <span className="block truncate text-[11px] text-white/50">{r.airline.name}{r.codeshares.length ? ` · also ${r.codeshares.slice(0, 2).join(", ")}` : ""}</span>
                          </span>
                        </span>
                        <span className="hidden min-w-0 md:block"><span className="block truncate font-bold">{r.other.city}</span><span className="font-mono text-[11px] text-white/50">{r.other.iata}</span></span>
                        <span className="hidden font-mono text-sm font-bold md:block">{r.terminal || "–"}</span>
                        <span className="hidden font-mono text-sm font-bold md:block">{(type === "departure" ? r.gate : r.baggage) || "–"}</span>
                        <span className="text-right md:text-left">
                          <span className={cn("block text-sm font-extrabold", tone)}>{label2}</span>
                          {late && <span className="block text-[11px] font-bold text-amber-300">+{r.delay} min</span>}
                          <span className="block font-mono text-[11px] text-white/50 md:hidden">{r.other.iata} · T{r.terminal || "–"}{type === "departure" && r.gate ? ` · Gate ${r.gate}` : ""}{type === "arrival" && r.baggage ? ` · Belt ${r.baggage}` : ""}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-5 py-3 text-[11px] text-white/50">
                <Database className="h-3.5 w-3.5" /> aviationstack real-time · {d.cached ? `updated ${timeAgo(d.fetchedAt)}` : "just updated"} · {d.rows.length} flights (aviationstack returns up to 100 rows per board, codeshares included) · times are local · tap a flight to track it
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
