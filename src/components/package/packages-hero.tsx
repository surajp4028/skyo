"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, ShieldCheck, Sparkles, Star, Wallet } from "lucide-react";
import type { TourPackage } from "@/lib/packages";
import { cn } from "@/lib/utils";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const priceBasis = (p: Pick<TourPackage, "pricingType">) => (p.pricingType === "per_couple" ? "per couple · 2 guests" : "per person");
const SLIDE_MS = 6000;
const FALLBACK = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=85&w=2000";

/**
 * Packages hero — bright and airy: a full-colour photo banner that slides through the real trips,
 * a white search card floating over it with destination chips, and a light trust row.
 */
export function PackagesHero({ packages, q, setQ, onExplore }: { packages: TourPackage[]; q: string; setQ: (v: string) => void; onExplore: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = Math.max(1, packages.length);
  useEffect(() => {
    if (paused || packages.length < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % packages.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, paused, packages.length]);
  const cur = packages[i % n];
  const places = useMemo(() => [...new Set(packages.flatMap((p) => p.destinations))], [packages]);
  const from = packages.length ? Math.min(...packages.map((p) => p.discountedPrice)) : null;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <section className="relative -mt-20 overflow-hidden bg-[linear-gradient(180deg,#dcecff_0%,#eef6ff_40%,#f6f7fb_100%)] pb-4 pt-24 md:pt-28">
      <div aria-hidden className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />
      <div aria-hidden className="absolute -right-20 top-10 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* title row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand shadow-soft ring-1 ring-orange-100">
              <Sparkles className="h-3.5 w-3.5" /> SKYO Holidays
            </span>
            <h1 className="mt-3 font-lux text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-ink md:text-[46px]">
              Holidays, <span className="bg-gradient-to-r from-[#b8740a] via-[#d9822b] to-[#ff5a1f] bg-clip-text pr-1 italic text-transparent">planned end to end</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted md:text-base">Day-by-day routes, honest prices and every inclusion — before you pay.</p>
          </div>
          <div className="flex gap-2">
            {[
              [String(packages.length), packages.length === 1 ? "trip" : "trips"],
              [String(places.length), "places"],
              [from != null ? inr(from) : "—", "starting"],
            ].map(([a, b]) => (
              <div key={b} className="rounded-2xl bg-white px-4 py-2.5 text-center shadow-soft ring-1 ring-line">
                <div className="text-lg font-extrabold leading-none text-ink">{a}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">{b}</div>
              </div>
            ))}
          </div>
        </div>

        {/* banner */}
        <div className="relative mt-5 h-[280px] overflow-hidden rounded-[24px] sm:mt-6 sm:rounded-[28px] bg-sky-100 shadow-[0_30px_70px_-35px_rgba(10,40,90,.55)] sm:h-[360px] md:h-[400px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <AnimatePresence initial={false}>
            <motion.div key={cur?.id ?? "x"} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
              <motion.div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${cur?.coverPhoto || FALLBACK}")` }} initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: SLIDE_MS / 1000 + 1, ease: "linear" }} />
            </motion.div>
          </AnimatePresence>

          {cur && (
            <AnimatePresence mode="wait">
              <motion.div key={cur.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }} className="absolute bottom-3 left-3 right-3 max-w-md rounded-[18px] bg-white/90 p-3 text-ink shadow-[0_20px_50px_-25px_rgba(10,30,70,.6)] ring-1 ring-white/70 backdrop-blur-xl sm:bottom-12 sm:left-auto sm:right-6 sm:rounded-[22px] sm:p-4 md:bottom-14 md:right-8 md:p-5">
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-extrabold text-sky-700">{cur.durationDays}D / {cur.durationNights}N</span>
                  {cur.featured && <span className="flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-extrabold text-amber-950"><Star className="h-3 w-3 fill-current" /> Popular</span>}
                </div>
                <h2 className="truncate text-base font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-xl md:text-2xl">{cur.title}</h2>
                <div className="mt-1 hidden items-center gap-1 text-xs font-semibold text-muted sm:flex"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{cur.destinations.join(" · ")}</span></div>
                <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 sm:mt-3 sm:flex-wrap sm:gap-3 sm:pt-3">
                  <div className="min-w-0">
                    <span className="text-base font-black sm:text-lg">{inr(cur.discountedPrice)}</span>
                    {cur.originalPrice > cur.discountedPrice && <span className="ml-1.5 text-xs text-muted line-through">{inr(cur.originalPrice)}</span>}
                    <span className="ml-1 block text-[10px] font-semibold text-muted sm:ml-1.5 sm:inline sm:text-[11px]">{priceBasis(cur)}</span>
                  </div>
                  <Link href={`/packages/${cur.slug}`} className="group ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,90,31,.9)] transition hover:brightness-110">
                    View package <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {cur && (
            <div className="absolute left-3 top-3 flex gap-1.5 sm:hidden">
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-ink shadow">{cur.durationDays}D / {cur.durationNights}N</span>
              {cur.featured && <span className="flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-extrabold text-amber-950 shadow"><Star className="h-3 w-3 fill-current" /> Popular</span>}
            </div>
          )}
          {packages.length > 1 && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:bottom-5 sm:right-auto sm:top-auto sm:left-6 sm:gap-2 md:left-8 flex items-center gap-2 sm:left-6 sm:right-auto md:left-8">
              <div className="mr-1 hidden gap-1.5 sm:flex">
                {packages.map((p, k) => (
                  <button key={p.id} type="button" onClick={() => setI(k)} aria-label={`Show ${p.title}`} className={cn("h-1.5 rounded-full transition-all", k === i % n ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white")} />
                ))}
              </div>
              {[-1, 1].map((d) => (
                <button key={d} type="button" onClick={() => go(d)} aria-label={d < 0 ? "Previous trip" : "Next trip"} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white sm:h-9 sm:w-9">
                  {d < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* search card, floating over the banner's edge */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onExplore();
          }}
          className="relative z-10 mx-auto mt-4 max-w-4xl rounded-[22px] bg-white p-4 sm:-mt-8 sm:rounded-[24px] shadow-[0_24px_60px_-28px_rgba(10,30,70,.45)] ring-1 ring-line md:p-5"
        >
          <div className="text-sm font-extrabold text-ink md:text-base">Search by destination</div>
          <div className="mt-3 flex gap-2">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 transition focus-within:border-brand focus-within:bg-white">
              <Search className="h-4 w-4 shrink-0 text-brand" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Kedarnath, Chopta or Rishikesh" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink/40" />
              {q && <button type="button" onClick={() => setQ("")} className="text-xs font-bold text-muted hover:text-ink">Clear</button>}
            </label>
            <button className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_-12px_rgba(255,90,31,.9)] transition hover:brightness-110">
              <span className="hidden sm:inline">Search</span> <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {places.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {places.slice(0, 8).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setQ(q === c ? "" : c);
                    onExplore();
                  }}
                  className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition", q === c ? "bg-ink text-white" : "bg-surface text-ink/75 hover:bg-orange-50 hover:text-brand")}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* light trust row */}
        <div className="mx-auto mt-5 grid max-w-4xl grid-cols-2 gap-2 md:grid-cols-4">
          {[
            [CalendarDays, "Day-by-day plan", "text-sky-600 bg-sky-50"],
            [BadgeCheck, "Clear inclusions", "text-emerald-600 bg-emerald-50"],
            [Wallet, "No hidden charges", "text-orange-600 bg-orange-50"],
            [ShieldCheck, "Secure checkout", "text-violet-600 bg-violet-50"],
          ].map(([Icon, t, c]) => {
            const I = Icon as typeof Search;
            return (
              <div key={t as string} className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2.5 text-xs font-bold text-ink ring-1 ring-line">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", c as string)}><I className="h-3.5 w-3.5" /></span>
                {t as string}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
