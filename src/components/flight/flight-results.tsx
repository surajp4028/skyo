"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, CloudSun, Database, Filter, Moon, Plane, SearchX, SlidersHorizontal, Sun, Sunrise, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { FlightSearchBar, type FlightQuery } from "./flight-search-bar";
import { FlightCard } from "./flight-card";
import { FlightSheet } from "./flight-sheet";
import { AirlineLogo } from "./airline-logo";
import { airlineInfo, type CabinKey } from "@/lib/flight/airlines";
import { addDays, slotOfTime, todayIST, type FlightOption } from "@/lib/flight/model";
import { fmtINR, prettyDate } from "@/lib/train/format";
import { saveRecentFlightSearch } from "@/lib/client/recent-flight";
import { cn, timeAgo } from "@/lib/utils";

type Result = { options: FlightOption[]; meta: { source: string; fetchedAt: string | null; sourceDate: string | null; stale: boolean; devSingle: boolean; totalBeforeLimit: number; connections: boolean; routeFound: boolean } };

const SLOTS = [
  { key: "early", label: "Before 6 AM", icon: Sunrise },
  { key: "morning", label: "6 AM – 12 PM", icon: Sun },
  { key: "afternoon", label: "12 PM – 6 PM", icon: CloudSun },
  { key: "night", label: "After 6 PM", icon: Moon },
] as const;
const SORTS = [
  { key: "price", label: "Cheapest" },
  { key: "dur", label: "Fastest" },
  { key: "dep", label: "Earliest" },
  { key: "arr", label: "Arrives first" },
] as const;

export function FlightResults({ q }: { q: FlightQuery }) {
  const router = useRouter();
  const key = `${q.from}|${q.to}|${q.date}|${q.cabin}`;
  const [state, setState] = useState<{ key: string; data?: Result; error?: string } | null>(null);
  const [stops, setStops] = useState<number[]>([]);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("price");
  const [sheet, setSheet] = useState<{ o: FlightOption; cabin: CabinKey } | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const today = todayIST();

  useEffect(() => saveRecentFlightSearch({ fromLabel: q.fromLabel, toLabel: q.toLabel, date: q.date, cabin: q.cabin, adults: q.adults }), [q.fromLabel, q.toLabel, q.date, q.cabin, q.adults]);
  useEffect(() => {
    let alive = true;
    api<Result>(`/api/flight/search?${new URLSearchParams({ from: q.from, to: q.to, date: q.date, cabin: q.cabin })}`)
      .then((r) => alive && setState({ key, data: r }))
      .catch((e) => alive && setState({ key, error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [key, q.from, q.to, q.date, q.cabin]);

  const loading = !state || state.key !== key;
  const all = useMemo(() => (state?.key === key ? state.data?.options || [] : []), [state, key]);
  const meta = state?.key === key ? state.data?.meta : undefined;
  const price = (o: FlightOption) => (o.fares[q.cabin] ?? o.fares.economy)!.perAdultPaise;
  const airlineList = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of all) for (const a of new Set(o.legs.map((l) => l.airline.iata))) m.set(a, Math.min(m.get(a) ?? Infinity, price(o)));
    return [...m.entries()].sort((a, b) => a[1] - b[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const list = useMemo(() => {
    const l = all.filter((o) => (!stops.length || stops.includes(Math.min(o.stops, 1))) && (!airlines.length || o.legs.some((x) => airlines.includes(x.airline.iata))) && (!slots.length || slots.includes(slotOfTime(o.dep))));
    const t = (s: string) => Number(s.replace(":", ""));
    const has = (o: FlightOption) => (o.fares[q.cabin] ? 0 : 1);
    return l.sort((a, b) =>
      has(a) - has(b) ||
      (sort === "price" ? price(a) - price(b) : sort === "dur" ? a.durationMin - b.durationMin : sort === "dep" ? t(a.dep) - t(b.dep) : t(a.arr) + a.dayOffset * 2400 - (t(b.arr) + b.dayOffset * 2400)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, stops, airlines, slots, sort]);
  const cheapest = list.length ? Math.min(...list.map(price)) : null;
  const go = (date: string) => router.push(`/flights?${new URLSearchParams({ from: q.from, to: q.to, date, cabin: q.cabin, adults: String(q.adults) })}`);
  const toggle = <T,>(arr: T[], set: (v: T[]) => void, v: T) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const anyFilter = stops.length || airlines.length || slots.length;

  const filters = (
    <div className="space-y-6">
      <Group title="Stops">
        <div className="grid grid-cols-2 gap-2">
          {[[0, "Non-stop"], [1, "1 stop"]].map(([v, l]) => (
            <button key={v} onClick={() => toggle(stops, setStops, v as number)} className={cn("rounded-xl border px-3 py-2 text-xs font-bold transition", stops.includes(v as number) ? "border-[#0057ff] bg-sky-50 text-[#0057ff]" : "border-line text-ink/60 hover:border-ink/30")}>{l}</button>
          ))}
        </div>
      </Group>
      <Group title="Departure">
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((s) => (
            <button key={s.key} onClick={() => toggle(slots, setSlots, s.key)} className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-bold transition", slots.includes(s.key) ? "border-[#0057ff] bg-sky-50 text-[#0057ff]" : "border-line text-ink/60 hover:border-ink/30")}>
              <s.icon className="h-4 w-4" /> {s.label}
            </button>
          ))}
        </div>
      </Group>
      {airlineList.length > 0 && (
        <Group title="Airlines">
          <div className="space-y-1">
            {airlineList.map(([a, p]) => (
              <label key={a} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-semibold hover:bg-surface">
                <input type="checkbox" checked={airlines.includes(a)} onChange={() => toggle(airlines, setAirlines, a)} className="h-4 w-4 accent-[#0057ff]" />
                <AirlineLogo iata={a} size={24} className="rounded-lg" />
                <span className="min-w-0 flex-1 truncate">{airlineInfo(a).name}</span>
                <span className="text-xs font-bold text-muted">{fmtINR(p / 100)}</span>
              </label>
            ))}
          </div>
        </Group>
      )}
    </div>
  );

  return (
    <div>
      <section className="relative -mt-20 overflow-hidden pb-10 pt-28">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0a3dcc_0%,#1f6dff_45%,#8ccaff_100%)]" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.7),transparent_65%)]" />
        <motion.div className="pointer-events-none absolute right-[8%] top-24 hidden text-white/25 md:block" initial={{ x: -40, y: 20, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ duration: 1.4 }}>
          <Plane className="h-24 w-24 -rotate-12 fill-white/20" />
        </motion.div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-white">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">{q.fromLabel.replace(/\s*\(.*\)$/, "")} <ArrowRight className="h-6 w-6" /> {q.toLabel.replace(/\s*\(.*\)$/, "")}</h1>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">{prettyDate(q.date, { weekday: "long", day: "numeric", month: "long" })} · {q.adults} traveller{q.adults > 1 ? "s" : ""} · {q.cabin === "business" ? "Business" : "Economy"}</span>
          </div>
          <div className="rounded-[28px] border border-white/70 bg-white/95 p-3 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.5)] backdrop-blur-xl md:p-4">
            <FlightSearchBar initial={q} compact />
          </div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {[-3, -2, -1, 0, 1, 2, 3, 4, 5].map((d) => {
              const iso = addDays(q.date, d);
              if (iso < today) return null;
              return (
                <button key={iso} onClick={() => go(iso)} className={cn("min-w-[88px] shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-bold transition", d === 0 ? "bg-white text-ink shadow-lg" : "bg-white/15 text-white backdrop-blur hover:bg-white/25")}>
                  {prettyDate(iso, { weekday: "short" })}
                  <div className="text-sm font-extrabold">{prettyDate(iso, { day: "numeric", month: "short" })}</div>
                  {d === 0 && cheapest != null && <div className="text-[10px] font-bold text-[#0057ff]">{fmtINR(cheapest / 100)}</div>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-line bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-extrabold"><Filter className="h-4 w-4" /> Filters</h2>
              {anyFilter ? <button onClick={() => (setStops([]), setAirlines([]), setSlots([]))} className="text-xs font-bold text-[#0057ff]">Clear</button> : null}
            </div>
            {filters}
          </div>
        </aside>

        <div className="min-h-[70vh]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-2xl border border-line bg-white p-1 shadow-soft">
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} className={cn("relative rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-4", sort === s.key ? "text-white" : "text-ink/60 hover:text-ink")}>
                  {sort === s.key && <motion.span layoutId="flight-sort" className="absolute inset-0 rounded-xl bg-ink" />}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMobileFilters(true)} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold lg:hidden"><SlidersHorizontal className="h-4 w-4" /> Filters{anyFilter ? ` (${stops.length + airlines.length + slots.length})` : ""}</button>
            <p className="w-full text-sm font-semibold text-muted sm:w-auto">{loading ? "Searching flights…" : `${list.length} of ${all.length} flight${all.length === 1 ? "" : "s"}`}</p>
          </div>

          {!loading && meta && (
            <div className="mb-4 space-y-2">
              {meta.devSingle && <p className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Dev mode: showing 1 of {meta.totalBeforeLimit} flights · turn off in Admin → Settings → Flights</p>}
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Database className="h-3.5 w-3.5" /> Schedule from aviationstack{meta.fetchedAt ? ` · updated ${timeAgo(meta.fetchedAt)}` : ""}{meta.stale ? " · refresh pending" : ""}. Fares are SKYO prices, confirmed on the next step.</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-44 animate-shimmer rounded-[26px] bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />)}</div>
          ) : state?.error ? (
            <Empty icon={<AlertTriangle className="h-7 w-7" />} title="We couldn't load flights" text={state.error} />
          ) : list.length === 0 ? (
            <Empty icon={<SearchX className="h-7 w-7" />} title={all.length ? "No flights match your filters" : "No flights on this route"} text={all.length ? "Try removing a filter." : meta?.routeFound ? "Every flight on this date has already left — try tomorrow." : "We couldn't find scheduled flights between these airports. Try a nearby city."} action={anyFilter ? <button onClick={() => (setStops([]), setAirlines([]), setSlots([]))} className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">Clear filters</button> : undefined} />
          ) : (
            <div className="space-y-4">
              {list.map((o, i) => <FlightCard key={o.id} o={o} cabin={q.cabin} adults={q.adults} index={i} onSelect={(c) => setSheet({ o, cabin: c })} />)}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mobileFilters && (
          <motion.div className="fixed inset-0 z-[90] flex items-end lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileFilters(false)} />
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">Filters</h2><button onClick={() => setMobileFilters(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
              {filters}
              <button onClick={() => setMobileFilters(false)} className="mt-5 w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white">Show {list.length} flights</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{sheet && <FlightSheet key={sheet.o.id} o={sheet.o} initialCabin={sheet.cabin} q={q} onClose={() => setSheet(null)} />}</AnimatePresence>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[26px] border border-dashed border-line bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-[#0057ff]">{icon}</span>
      <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}
