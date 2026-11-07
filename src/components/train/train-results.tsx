"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, CloudSun, Filter, Moon, SearchX, Sun, Sunrise } from "lucide-react";
import { trainApi } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { RouteTrains } from "@/lib/server/train/types";
import { TrainCard } from "./train-card";
import { CardSkeleton, TrainLoader } from "./train-loader";
import { TrainSearchBar, type TrainQuery } from "./train-search-bar";
import { addDaysISO, istISO, prettyDate, prettyType, quotaLabel, slotOf, toMinutes } from "@/lib/train/format";
import { cn } from "@/lib/utils";

const SLOTS = [
  { key: "early", label: "Early", sub: "12a–6a", icon: Sunrise },
  { key: "morning", label: "Morning", sub: "6a–12p", icon: Sun },
  { key: "afternoon", label: "Afternoon", sub: "12p–6p", icon: CloudSun },
  { key: "night", label: "Night", sub: "6p–12a", icon: Moon },
];
const SORTS = [
  { key: "dep", label: "Earliest" },
  { key: "dur", label: "Fastest" },
  { key: "arr", label: "Arrives first" },
  { key: "rating", label: "On-time" },
] as const;

export function TrainResults({ q, initialSlots }: { q: TrainQuery; initialSlots: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<{ key: string; data?: RouteTrains; error?: string } | null>(null);
  const key = `${q.from}|${q.to}|${q.date}|${q.quota}`;
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [classes, setClasses] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("dep");
  const [showFilters, setShowFilters] = useState(false);
  const resultsTop = useRef<HTMLDivElement>(null);
  const filterSig = `${slots.join()}|${classes.join()}|${types.join()}|${onlyAvail}|${sort}`;
  const firstSig = useRef(filterSig);

  // When filters shrink the list, keep the user at the top of the results instead of
  // letting the page collapse onto the footer.
  useEffect(() => {
    if (firstSig.current === filterSig) return;
    firstSig.current = filterSig;
    const el = resultsTop.current;
    if (el && el.getBoundingClientRect().top < 80) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
  }, [filterSig]);

  useEffect(() => {
    let alive = true;
    trainApi<RouteTrains>("/between", { from: q.from, to: q.to, date: q.date, quota: q.quota })
      .then((r) => alive && setState({ key, data: r.data }))
      .catch((e) => alive && setState({ key, error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [key, q.from, q.to, q.date, q.quota]);

  const loading = !state || state.key !== key;
  const all = useMemo(() => (state?.key === key ? state.data?.trains || [] : []), [state, key]);
  const devLimited = state?.key === key ? (state.data as (RouteTrains & { dev_limited?: { shown: number; total: number } }) | undefined)?.dev_limited : undefined;
  const allClasses = useMemo(() => [...new Set(all.flatMap((t) => t.classes || []))], [all]);
  const allTypes = useMemo(() => [...new Set(all.map((t) => t.train_type).filter(Boolean))], [all]);

  const list = useMemo(() => {
    let l = all.filter((t) => {
      if (slots.length && !slots.includes(slotOf(t.departure_time))) return false;
      if (classes.length && !t.classes?.some((c) => classes.includes(c))) return false;
      if (types.length && !types.includes(t.train_type)) return false;
      if (onlyAvail && !t.availability_summary?.some((a) => a.status === "AVAILABLE" || a.status === "RAC")) return false;
      return true;
    });
    const arrAbs = (t: (typeof l)[number]) => (toMinutes(t.departure_time) ?? 0) + t.duration_minutes;
    l = [...l].sort((a, b) =>
      sort === "dur" ? a.duration_minutes - b.duration_minutes : sort === "arr" ? arrAbs(a) - arrAbs(b) : sort === "rating" ? (b.on_time_rating ?? 0) - (a.on_time_rating ?? 0) : (toMinutes(a.departure_time) ?? 0) - (toMinutes(b.departure_time) ?? 0),
    );
    return l;
  }, [all, slots, classes, types, onlyAvail, sort]);

  const go = (date: string) => router.push(`/trains?${new URLSearchParams({ from: q.from, to: q.to, date, quota: q.quota, fl: q.fromLabel, tl: q.toLabel })}`);
  const today = istISO(0);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filters = (
    <div className="space-y-6">
      <FilterGroup title="Departure time">
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((s) => (
            <button key={s.key} onClick={() => toggle(slots, setSlots, s.key)} className={cn("flex flex-col items-center rounded-xl border p-2.5 text-xs font-bold transition", slots.includes(s.key) ? "border-brand bg-brand-soft text-brand" : "border-line text-ink/60 hover:border-ink/30")}>
              <s.icon className="h-4 w-4" />
              {s.label}
              <span className="text-[10px] font-medium opacity-70">{s.sub}</span>
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Class">
        <div className="flex flex-wrap gap-2">
          {allClasses.map((c) => (
            <button key={c} onClick={() => toggle(classes, setClasses, c)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-bold", classes.includes(c) ? "border-brand bg-brand-soft text-brand" : "border-line text-ink/60")}>{c}</button>
          ))}
        </div>
      </FilterGroup>
      {allTypes.length > 1 && (
        <FilterGroup title="Train type">
          <div className="space-y-1.5">
            {allTypes.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink/80">
                <input type="checkbox" checked={types.includes(t)} onChange={() => toggle(types, setTypes, t)} className="h-4 w-4 accent-[#ff5a1f]" /> {prettyType(t)}
              </label>
            ))}
          </div>
        </FilterGroup>
      )}
      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface p-3 text-sm font-bold">
        Available / RAC only
        <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="h-4 w-4 accent-[#ff5a1f]" />
      </label>
    </div>
  );

  return (
    <div>
      {/* Sky header */}
      <section className="relative -mt-20 overflow-hidden pb-10 pt-28">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b72f5_0%,#2f8fff_45%,#7cc4ff_100%)]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.75),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-white">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">{q.fromLabel.replace(/\s*\(.*\)$/, "")} <ArrowRight className="h-6 w-6" /> {q.toLabel.replace(/\s*\(.*\)$/, "")}</h1>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">{prettyDate(q.date, { weekday: "long", day: "numeric", month: "long" })} · {quotaLabel(q.quota)}</span>
          </div>
          <div className="rounded-[28px] border border-white/70 bg-white/95 p-3 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.5)] backdrop-blur-xl md:p-4">
            <TrainSearchBar initial={q} compact />
          </div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {[-3, -2, -1, 0, 1, 2, 3].map((d) => {
              const iso = addDaysISO(q.date, d);
              if (iso < today) return null;
              return (
                <button key={iso} onClick={() => go(iso)} className={cn("min-w-[92px] shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-bold transition", d === 0 ? "bg-white text-ink shadow-lg" : "bg-white/15 text-white backdrop-blur hover:bg-white/25")}>
                  {prettyDate(iso, { weekday: "short" })}
                  <div className="text-sm font-extrabold">{prettyDate(iso, { day: "numeric", month: "short" })}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-line bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-extrabold"><Filter className="h-4 w-4" /> Filters</h2>
              {(slots.length || classes.length || types.length || onlyAvail) ? (
                <button onClick={() => (setSlots([]), setClasses([]), setTypes([]), setOnlyAvail(false))} className="text-xs font-bold text-brand">Clear</button>
              ) : null}
            </div>
            {filters}
          </div>
        </aside>

        <div ref={resultsTop} className="min-h-[80vh] scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">{loading ? "Searching live trains…" : `${list.length} of ${all.length} trains`}</p>
            {!loading && devLimited && <p className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Dev mode: showing 1 of {devLimited.total} trains (Admin → Settings → Trains)</p>}
            <div className="flex items-center gap-1 rounded-2xl bg-white p-1 shadow-soft ring-1 ring-line">
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} className={cn("relative rounded-xl px-3 py-1.5 text-xs font-bold transition", sort === s.key ? "text-white" : "text-ink/60 hover:text-ink")}>
                  {sort === s.key && <motion.span layoutId="train-sort" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilters((v) => !v)} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold lg:hidden"><Filter className="mr-1 inline h-3.5 w-3.5" /> Filters</button>
          </div>
          <AnimatePresence>{showFilters && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="mb-4 overflow-hidden rounded-3xl border border-line bg-white p-5 lg:hidden">{filters}</motion.div>}</AnimatePresence>

          {loading ? (
            <div className="space-y-4">
              <TrainLoader />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : state?.error ? (
            <EmptyState icon={<AlertTriangle className="h-7 w-7" />} title="Couldn't load trains" text={state.error} />
          ) : list.length === 0 ? (
            <EmptyState icon={<SearchX className="h-7 w-7" />} title={all.length ? "No trains match your filters" : "No trains on this route"} text={all.length ? "Try clearing a filter." : "Try a nearby station or another date."} />
          ) : (
            <div className="space-y-4">
              {list.map((t, i) => (
                <TrainCard key={`${t.train_number}-${t.departure_time}`} t={t} from={q.from} to={q.to} date={q.date} quota={q.quota} index={i} />
              ))}
              <p className="pt-2 text-center text-[11px] text-muted">Live data by RailCore · Not affiliated with IRCTC / Indian Railways · Always verify before travel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line bg-white p-12 text-center shadow-soft">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{text}</p>
      <Link href="/?tab=train#search" className="mt-5 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">New search</Link>
    </motion.div>
  );
}
