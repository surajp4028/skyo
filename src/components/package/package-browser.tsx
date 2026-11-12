"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Compass, Landmark, MapPin, Mountain, Palmtree, Sparkles, Star, Tent, Heart, Users, PawPrint, Timer, Wallet, X, type LucideIcon } from "lucide-react";
import { upcomingDepartures, type TourPackage } from "@/lib/packages";
import { PACKAGE_CATEGORIES, inCategory } from "@/lib/package-categories";
import { PackagesHero, priceBasis } from "./packages-hero";
import { PopularPlaces } from "@/components/site/popular-places";
import { cn } from "@/lib/utils";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const text = (p: TourPackage) => `${p.title} ${p.destinations.join(" ")} ${p.shortDescription}`.toLowerCase();
const LOOK: Record<string, { icon: LucideIcon; tint: string }> = {
  trending: { icon: Sparkles, tint: "from-amber-400 to-orange-500" },
  pilgrimage: { icon: Landmark, tint: "from-orange-500 to-rose-500" },
  mountains: { icon: Mountain, tint: "from-sky-500 to-indigo-500" },
  beaches: { icon: Palmtree, tint: "from-teal-400 to-cyan-500" },
  heritage: { icon: Compass, tint: "from-violet-500 to-fuchsia-500" },
  adventure: { icon: Tent, tint: "from-red-500 to-orange-500" },
  honeymoon: { icon: Heart, tint: "from-pink-500 to-rose-500" },
  family: { icon: Users, tint: "from-blue-500 to-cyan-500" },
  wildlife: { icon: PawPrint, tint: "from-green-600 to-lime-500" },
  weekend: { icon: Timer, tint: "from-emerald-400 to-teal-500" },
  budget: { icon: Wallet, tint: "from-lime-500 to-emerald-500" },
};
type Category = { key: string; label: string; sub: string; icon: LucideIcon; tint: string; test: (p: TourPackage) => boolean };
const CATEGORIES: Category[] = PACKAGE_CATEGORIES.map((c) => ({ key: c.key, label: c.label, sub: c.sub, ...LOOK[c.key], test: (p: TourPackage) => inCategory(p, c) }));

const monthKey = (d: string) => d.slice(0, 7);
const monthName = (k: string, style: "long" | "short" = "long") => new Date(`${k}-01T00:00:00Z`).toLocaleString("en-IN", { month: style, timeZone: "UTC" });

export function PackageBrowser({ packages, initialDestination }: { packages: TourPackage[]; initialDestination: string }) {
  const [q, setQ] = useState(initialDestination);
  const [sort, setSort] = useState("featured");
  const [cat, setCat] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  const cats = useMemo(() => CATEGORIES.map((c) => ({ ...c, list: packages.filter(c.test) })).filter((c) => c.list.length), [packages]);
  const months = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const p of packages) for (const d of upcomingDepartures(p)) {
      const k = monthKey(d.startDate);
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(p.id);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 8).map(([k, ids]) => ({ key: k, ids }));
  }, [packages]);
  const activeMonth = months.find((m) => m.key === month) || months[0];
  const monthList = activeMonth ? packages.filter((p) => activeMonth.ids.has(p.id)) : [];

  const rows = useMemo(() => {
    const c = CATEGORIES.find((x) => x.key === cat);
    const f = packages.filter((p) => (!q || text(p).includes(q.toLowerCase())) && (!c || c.test(p)));
    return [...f].sort((a, b) => (sort === "price" ? a.discountedPrice - b.discountedPrice : sort === "duration" ? a.durationDays - b.durationDays : Number(b.featured) - Number(a.featured)));
  }, [packages, q, sort, cat]);

  const toTrips = () => setTimeout(() => document.getElementById("trips")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  const viewAll = (key: string) => {
    setCat(key);
    toTrips();
  };
  const curCat = CATEGORIES.find((x) => x.key === cat);

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-12">
      <PackagesHero packages={packages} q={q} setQ={setQ} onExplore={toTrips} />

      {/* categories, the ixigo way: round photo tiles you swipe through */}
      {cats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <Heading eyebrow="Pick your vibe" title="Browse by" accent="Category" sub="Find the kind of trip you love" />
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0">
            {cats.map((c) => {
              const I = c.icon;
              return (
                <button key={c.key} onClick={() => viewAll(c.key)} className="group flex w-[84px] shrink-0 snap-start flex-col items-center text-center sm:w-[104px]">
                  <span className="relative h-[76px] w-[76px] overflow-hidden rounded-full p-[3px] sm:h-[92px] sm:w-[92px]">
                    <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br", c.tint)} />
                    <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-white bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `url("${c.list[0].coverPhoto}")` }} />
                    <span className={cn("absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br text-white sm:h-7 sm:w-7", c.tint)}><I className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></span>
                  </span>
                  <span className="mt-2 text-[11px] font-extrabold leading-tight text-ink sm:text-xs">{c.label}</span>
                  <span className="text-[10px] font-semibold text-muted">{c.list.length} {c.list.length === 1 ? "trip" : "trips"}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* browse by month */}
      {months.length > 0 && activeMonth && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <Heading eyebrow="Plan ahead" title="Browse by" accent="Months" sub="Find your favourite travel month" />
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {months.map((m) => (
              <button key={m.key} onClick={() => setMonth(m.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition", m.key === activeMonth.key ? "border-ink bg-ink text-white shadow" : "border-line bg-white text-ink hover:border-ink/30")}>
                <CalendarDays className="h-3.5 w-3.5" /> {monthName(m.key)} <span className={m.key === activeMonth.key ? "text-white/70" : "text-muted"}>({m.ids.size})</span>
              </button>
            ))}
          </div>
          <Rail list={monthList} className="mt-4" month={activeMonth.key} />
        </section>
      )}

      {/* one swipeable rail per category */}
      {cats.map((c) => (
        <section key={c.key} className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
          <Heading accent={c.label} title="Packages" accentFirst sub={`${c.list.length} ${c.list.length === 1 ? "package" : "packages"} • ${c.sub}`} action={<button onClick={() => viewAll(c.key)} className="group inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-orange-100 transition hover:bg-brand hover:text-white">View all<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></button>} />
          <Rail list={c.list} className="mt-4" />
        </section>
      ))}

      <PopularPlaces className="pt-12" eyebrow="Where to next" title="Popular tour places" sub="Mountains, beaches, forts and backwaters — tap a place to see its trips." />

      {/* everything, filterable */}
      <section id="trips" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <Eyebrow>Not sure where to go?</Eyebrow>
            <h2 className="mt-1 font-lux text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">{curCat ? <><Accent>{curCat.label}</Accent> Packages</> : <>All tour <Accent>Packages</Accent></>}</h2>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted shadow-soft">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 bg-transparent text-xs font-bold normal-case tracking-normal text-ink outline-none">
              <option value="featured">Recommended</option>
              <option value="price">Price: low to high</option>
              <option value="duration">Duration</option>
            </select>
          </label>
        </div>
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip on={!cat} onClick={() => setCat(null)}>All ({packages.length})</Chip>
          {cats.map((c) => <Chip key={c.key} on={cat === c.key} onClick={() => setCat(c.key)}>{c.label} ({c.list.length})</Chip>)}
          {q && <Chip on onClick={() => setQ("")}><MapPin className="h-3 w-3" /> {q} <X className="h-3 w-3" /></Chip>}
        </div>
        {rows.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((p, i) => <Card key={p.id} p={p} i={i} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-brand"><MapPin className="h-5 w-5" /></div>
            <h3 className="mt-3 font-extrabold">No trips match that yet</h3>
            <p className="mt-1 text-sm text-muted">Try another place or category.</p>
            <button onClick={() => (setQ(""), setCat(null))} className="mt-4 rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white">Show every trip</button>
          </div>
        )}
      </section>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.28em] text-[#8a6a2f]">
      <span className="h-px w-5 bg-gradient-to-r from-transparent to-[#c79a4a]" />
      {children}
    </p>
  );
}

/** The one italic, gold-to-saffron word that gives each heading its luxury feel. */
function Accent({ children }: { children: React.ReactNode }) {
  return <span className="bg-gradient-to-r from-[#b8740a] via-[#d9822b] to-[#ff5a1f] bg-clip-text pr-1 italic text-transparent">{children}</span>;
}

export function Heading({ eyebrow, title, accent, accentFirst, sub, action }: { eyebrow?: string; title: string; accent?: string; accentFirst?: boolean; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1 font-lux text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink sm:text-[28px]">
          {accentFirst ? <><Accent>{accent}</Accent> {title}</> : <>{title} {accent && <Accent>{accent}</Accent>}</>}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-muted sm:truncate sm:text-[13px]">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Chip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition", on ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/30")}>
      {children}
    </button>
  );
}

/** A horizontal, snap-scrolling row of trip cards — swipe on phones, arrows on desktop. */
export function Rail({ list, className, month }: { list: TourPackage[]; className?: string; month?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (d: number) => ref.current?.scrollBy({ left: d * Math.max(280, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className={cn("group/rail relative", className)}>
      <div ref={ref} className="no-scrollbar -mx-4 -mb-10 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden scroll-px-4 px-4 pb-10 pt-1 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0">
        {list.map((p, i) => (
          <div key={p.id} className="w-[78%] max-w-[300px] shrink-0 snap-start sm:w-[290px]">
            <Card p={p} i={i} month={month} />
          </div>
        ))}
      </div>
      {list.length > 3 && (
        <>
          <button aria-label="Scroll left" onClick={() => move(-1)} className="absolute -left-4 top-[30%] hidden h-10 w-10 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-lift ring-1 ring-line transition group-hover/rail:opacity-100 md:flex"><ChevronLeft className="h-5 w-5" /></button>
          <button aria-label="Scroll right" onClick={() => move(1)} className="absolute -right-4 top-[30%] hidden h-10 w-10 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-lift ring-1 ring-line transition group-hover/rail:opacity-100 md:flex"><ChevronRight className="h-5 w-5" /></button>
        </>
      )}
    </div>
  );
}

function Card({ p, i, month }: { p: TourPackage; i: number; month?: string }) {
  const deps = upcomingDepartures(p);
  const next = (month && deps.find((d) => d.startDate.startsWith(month))) || deps[0];
  const price = next?.price || p.discountedPrice;
  const perks = [p.tripInfo?.travelMode, p.accommodations.length ? "Hotel" : null, p.tripInfo?.mealPlan && !/not/i.test(p.tripInfo.mealPlan) ? "Meals" : null].filter(Boolean) as string[];
  const off = p.originalPrice > price ? Math.round(((p.originalPrice - price) / p.originalPrice) * 100) : 0;
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: Math.min(i, 5) * 0.05 }} className="group h-full overflow-hidden rounded-[22px] border border-line bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/packages/${p.slug}`} className="flex h-full flex-col">
        <div className="relative h-44 overflow-hidden sm:h-48">
          <div className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${p.coverPhoto}")` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-md bg-white/95 px-2 py-1 font-mono text-[10px] font-medium tracking-[.08em] text-ink shadow">{p.durationNights}N/{p.durationDays}D</span>
            {p.featured && <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-extrabold text-amber-950 shadow"><Star className="h-3 w-3 fill-current" /> Popular</span>}
          </div>
          {off > 0 && <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-extrabold text-white shadow">{off}% off</span>}
          <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-1 text-[10px] font-bold text-white"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{p.destinations.join(" · ")}</span></div>
        </div>
        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-snug text-ink">{p.title}</h3>
          {perks.length > 0 && <p className="mt-1 truncate text-[11px] font-semibold text-muted">{perks.join(" • ")}</p>}
          {next && <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700"><CalendarDays className="h-3 w-3" /> Next: {new Date(`${next.startDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}{deps.length > 1 ? ` · +${deps.length - 1} more` : ""}</p>}
          <div className="min-h-3 flex-1" />
          <div className="flex items-end justify-between gap-2 border-t border-dashed border-line pt-3">
            <div className="min-w-0">
              <div className="text-lg font-extrabold leading-none text-ink">{inr(price)}{p.originalPrice > price && <span className="ml-1.5 text-[11px] font-semibold text-muted line-through">{inr(p.originalPrice)}</span>}</div>
              <div className="mt-1 text-[10px] font-semibold text-muted">onwards · {priceBasis(p)}</div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition group-hover:bg-brand"><ArrowRight className="h-4 w-4" /></span>
          </div>
          {p.upfrontTokenAmount > 0 && <div className="mt-2.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-center text-[11px] font-extrabold text-brand">Book now at {inr(p.upfrontTokenAmount)} only</div>}
        </div>
      </Link>
    </motion.article>
  );
}
