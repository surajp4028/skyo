"use client";
import Link from "next/link";
import { IMAGES, img } from "@/lib/utils";
import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from "motion/react";
import { ArrowRight, BusFront, Building2, ChevronDown, LogOut, Palmtree, Plane, TrainFront, User2, Headphones, Menu, X, Ticket, Radio, PlaneTakeoff, Armchair, Route, CalendarDays, MapPinned, ShieldCheck } from "lucide-react";
import { useAuth, useSite } from "@/lib/client/providers";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client/api";
import type { TourPackage } from "@/lib/packages";
import { isServiceOn, type ServiceKey } from "@/lib/services";

const LINKS = [
  { href: "/#search", label: "Trains", icon: TrainFront, tab: "train" },
  { href: "/#search", label: "Flights", icon: Plane, tab: "flight" },
  { href: "/#search", label: "Buses", icon: BusFront, tab: "bus" },
  { href: "/#search", label: "Hotels", icon: Building2, tab: "hotel" },
  { href: "/packages", label: "Packages", icon: Palmtree, tab: "package" },
];

/** Transparent over hero → frosted glass pill on scroll (Aceternity floating-nav feel). */
/** tone="light": over a light hero — transparent with dark text at the top, glass pill on scroll. */
export function Navbar({ overHero = true, tone = "dark" }: { overHero?: boolean; tone?: "dark" | "light" }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(!overHero);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState<"train" | "flight" | "package" | null>(null);
  const { user, logout } = useAuth();
  const site = useSite();
  // Hysteresis: the bar changes height when it turns into a pill, which moves the scroll position a little.
  // One threshold would make it flicker on short pages, so it turns on past 48 px and off only below 12 px.
  useMotionValueEvent(scrollY, "change", (v) => overHero && setScrolled((s) => (s ? v > 12 : v > 48)));
  const dark = overHero && !scrolled && tone !== "light";
  const links = LINKS.filter((l) => isServiceOn(site, l.tab as ServiceKey)); // white text over the blue sky, ink once the glass bar appears

  return (
    <div className="contents">
      {site.maintenance_mode === "on" && (
        <div className="relative z-[60] bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-center text-xs font-semibold text-white">{site.maintenance_message}</div>
      )}
      <motion.header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        className={cn("sticky top-0 z-50 transition-[padding] duration-300", scrolled ? "px-3 pt-3" : "px-0 pt-0")}
      >
        <nav
          className={cn(
            // border is always present (transparent) so it never flashes in currentColor while transitioning
            "mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border px-5 transition-[height,background-color,border-color,box-shadow] duration-300",
            scrolled ? "h-16 border-white/60 bg-white/75 shadow-soft backdrop-blur-xl" : "h-20 border-transparent bg-transparent shadow-none",
          )}
        >
          <Logo dark={dark} />
          <div className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setMega(null)} onKeyDown={(e) => e.key === "Escape" && setMega(null)}>
            {links.map((l) => (
              l.tab === "train" || l.tab === "flight" || l.tab === "package" ? (
                <button key={l.label} type="button" onMouseEnter={() => setMega(l.tab as "train" | "flight" | "package")} onFocus={() => setMega(l.tab as "train" | "flight" | "package")} onClick={() => setMega(l.tab as "train" | "flight" | "package")} className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition", dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink/70 hover:bg-ink/5 hover:text-ink")}>
                  <l.icon className="h-4 w-4" /> {l.label} <ChevronDown className={cn("h-3.5 w-3.5 transition", mega === l.tab && "rotate-180")} />
                </button>
              ) : (
                <Link key={l.label} href={l.href} className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition", dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink/70 hover:bg-ink/5 hover:text-ink")}><l.icon className="h-4 w-4" />{l.label}</Link>
              )
            ))}
            <AnimatePresence>
              {mega && <motion.div initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: "easeOut" }} onMouseEnter={() => setMega(mega)} className={cn("absolute left-1/2 top-[calc(100%-2px)] z-50 w-[min(1100px,calc(100vw-48px))] -translate-x-1/2 overflow-hidden rounded-[30px] border p-5 text-ink shadow-[0_32px_100px_-28px_rgba(10,15,31,.5)] backdrop-blur-2xl xl:p-6", mega === "train" ? "border-[#f2dfc7] bg-[#fffaf2]/95" : mega === "package" ? "border-[#d8e5d7] bg-[#f8fbf5]/95" : "border-sky-100 bg-[#f4faff]/95")}>
                {mega === "train" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-6">
                    <div className="min-w-0">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <div><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#c85a27]"><TrainFront className="h-3.5 w-3.5" /> SKYO RAIL · YOUR JOURNEY, IN MOTION</div><h2 className="mt-2 text-[25px] font-extrabold leading-tight tracking-tight">Make every rail trip easier</h2><p className="mt-1 text-xs text-muted">Plan, board and stay in control from one place.</p></div>
                        <Link href="/?tab=train#search" onClick={() => setMega(null)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#f26a32] to-[#e34f26] px-4 py-3 text-xs font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(214,83,38,.7)] transition hover:-translate-y-0.5 hover:shadow-lg">Find a train<ArrowRight className="h-3.5 w-3.5" /></Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          [TrainFront, "Book train tickets", "Compare trains, dates and classes", "/?tab=train#search"],
                          [Ticket, "Check your PNR", "Coach, berth and chart status", "/trains/pnr"],
                          [Radio, "Live train status", "Delays and upcoming stations", "/trains/live?tool=live"],
                          [TrainFront, "Station board", "Arrivals and departures", "/trains/live?tool=board"],
                          [Armchair, "Vacant berths", "Find seats along the route", "/trains/live?tool=berths"],
                          [ArrowRight, "Fare tools", "Local and unreserved fares", "/trains/live?tool=uts"],
                        ].map(([Icon, title, sub, href]) => { const I = Icon as typeof Ticket; return <Link key={title as string} href={href as string} onClick={() => setMega(null)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#f0e2d2] bg-white/90 p-3.5 transition hover:-translate-y-0.5 hover:border-[#e8bf99] hover:bg-white hover:shadow-[0_12px_28px_-20px_rgba(107,61,34,.4)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#fff1e6] text-[#ce5b2b] transition group-hover:bg-[#ce5b2b] group-hover:text-white"><I className="h-[18px] w-[18px]" /></span><span className="min-w-0"><span className="block text-[13px] font-extrabold leading-tight">{title as string}</span><span className="mt-1 block text-[11px] leading-snug text-muted">{sub as string}</span></span><ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[#ce5b2b]/60 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></Link>; })}
                      </div>
                    </div>
                    <div className="flex min-h-[320px] flex-col gap-3">
                      <div className="relative min-h-[176px] flex-1 overflow-hidden rounded-[22px] bg-cover bg-center shadow-[0_18px_40px_-25px_rgba(35,27,20,.65)]" style={{ backgroundImage: `linear-gradient(0deg,rgba(16,26,48,.78),rgba(16,26,48,.04) 78%),url("${img(IMAGES.train, 700, 450)}")` }}><div className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-white backdrop-blur-md">The joy is in the journey</div><div className="absolute bottom-4 left-4 right-4 text-white"><div className="text-xl font-extrabold tracking-tight">Take the scenic route.</div><div className="mt-1 text-[11px] text-white/80">A calmer way to plan every rail trip.</div></div></div>
                      <div className="rounded-[20px] border border-[#efdfcc] bg-white/90 p-3.5 shadow-[0_12px_30px_-24px_rgba(80,50,30,.35)]"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-muted">Popular rail route</span><span className="rounded-full bg-[#fff1e6] px-2 py-1 text-[9px] font-bold text-[#c85a27]">6–8 hrs</span></div><div className="mt-2.5 flex items-center gap-2"><div className="min-w-0"><div className="text-xs font-extrabold text-[#17223b]">New Delhi</div><div className="text-[9px] font-medium text-muted">NDLS</div></div><span className="relative mx-1 flex-1 border-t border-dashed border-[#d56732]/50"><TrainFront className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-white p-0.5 text-[#d56732]" /></span><div className="min-w-0 text-right"><div className="text-xs font-extrabold text-[#17223b]">Prayagraj</div><div className="text-[9px] font-medium text-muted">PRYJ</div></div></div></div>
                    </div>
                  </div>
                ) : mega === "flight" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
                    <div className="min-w-0">
                      <div className="mb-5 flex items-center justify-between gap-4"><div><div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-sky-600">SKYO AIR · TAKE OFF WITH CONFIDENCE</div><h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight">Your next flight, all mapped out</h2><p className="mt-1 text-xs text-muted">From fares and seats to airport updates, before you board.</p></div><Link href="/?tab=flight#search" onClick={() => setMega(null)} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-3 text-xs font-extrabold text-white shadow-lg transition hover:brightness-110">Search flights<ArrowRight className="h-3.5 w-3.5" /></Link></div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          [Plane, "Search flights", "Compare fares and connections", "/?tab=flight#search"],
                          [PlaneTakeoff, "Flight status", "Gate, terminal and live updates", "/flights/status"],
                          [Radio, "Airport live board", "Departures and arrivals", "/flights/airport"],
                          [Armchair, "Choose your seat", "Window, aisle or extra legroom", "/?tab=flight#search"],
                          [Ticket, "Manage your trip", "Tickets, travellers and invoices", "/account"],
                          [Route, "Smart connections", "Routes through major hubs", "/?tab=flight#search"],
                        ].map(([Icon, title, sub, href]) => { const I = Icon as typeof Ticket; return <Link key={title as string} href={href as string} onClick={() => setMega(null)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-sky-100 bg-white/90 p-3.5 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_35px_-24px_rgba(2,132,199,.6)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-sky-50 text-sky-700 transition group-hover:bg-sky-600 group-hover:text-white"><I className="h-[18px] w-[18px]" /></span><span className="min-w-0"><span className="block text-xs font-extrabold leading-tight">{title as string}</span><span className="mt-1 block text-[10px] leading-snug text-muted">{sub as string}</span></span><ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-sky-400 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></Link>; })}
                      </div>
                    </div>
                    <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[24px] bg-[#082f68] p-5 text-white">
                      <div className="absolute inset-0 bg-cover bg-center opacity-55" style={{ backgroundImage: `url("${img(IMAGES.plane, 700, 700)}")` }} />
                      <div className="absolute inset-0 bg-gradient-to-br from-[#075985]/70 via-[#082f68]/30 to-[#061b43]/90" />
                      <div className="relative flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-[.2em] text-sky-100">Departure board</span><PlaneTakeoff className="h-5 w-5 text-sky-200" /></div>
                      <div className="relative rounded-2xl border border-white/15 bg-[#061b43]/55 p-4 backdrop-blur-md"><div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/60"><span>Popular route</span><span className="text-emerald-300">Direct</span></div><div className="mt-3 flex items-center justify-between"><div><div className="text-2xl font-extrabold">DEL</div><div className="text-[10px] text-white/60">New Delhi</div></div><div className="mx-3 flex-1 border-t border-dashed border-sky-200/60"><Plane className="mx-auto -mt-2.5 h-5 w-5 rotate-90 bg-[#0b386f] text-sky-200" /></div><div className="text-right"><div className="text-2xl font-extrabold">BOM</div><div className="text-[10px] text-white/60">Mumbai</div></div></div><div className="mt-3 border-t border-white/10 pt-3 text-[11px] font-medium text-white/80">Check fares, seats and live flight updates</div></div>
                    </div>
                  </div>
                ) : (
                  <PackagesMega onClose={() => setMega(null)} />
                )}
              </motion.div>}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            <a href={`mailto:${site.support_email}`} className={cn("hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold md:flex", dark ? "text-white/80" : "text-ink/70")}>
              <Headphones className="h-4 w-4" /> Support
            </a>
            {user ? (
              <UserMenu dark={dark} name={user.name || user.email || user.phone || "Traveller"} avatar={user.avatar ?? null} onLogout={logout} />
            ) : (
              <Link href="/login" className="whitespace-nowrap rounded-full bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-[11px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-sm">
                Log in / Sign up
              </Link>
            )}
            <button className={cn("relative z-[60] rounded-full border p-2.5 lg:hidden", dark ? "border-white/30 bg-white/10 text-white" : "border-line bg-white/85 text-ink shadow-sm")} onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute left-0 right-0 top-full z-50 mx-3 mt-1 overflow-hidden rounded-[24px] border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_-20px_rgba(3,10,30,.38)] backdrop-blur-2xl lg:hidden">
              {links.map((l) => (
                <Link key={l.label} onClick={() => setOpen(false)} href={l.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><l.icon className="h-4 w-4" /></span> {l.label}<ArrowRight className="ml-auto h-4 w-4 text-muted/60" />
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </div>
  );
}

function UserMenu({ name, avatar, onLogout, dark }: { name: string; avatar: string | null; onLogout: () => Promise<void>; dark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} className={cn("flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm font-semibold", dark ? "border-white/20 text-white" : "border-line bg-white text-ink")}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-iris text-xs font-bold text-white">{name[0]?.toUpperCase()}</span>
        )}
        <span className="hidden max-w-[120px] truncate sm:inline">{name}</span>
        <ChevronDown className="hidden h-4 w-4 opacity-60 sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full z-50 w-56 pt-2">
            <div className="rounded-2xl border border-line bg-white p-1.5 shadow-lift">
              <Link href="/account" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface">
                <User2 className="h-4 w-4" /> My account & trips
              </Link>
              <button
                onClick={async () => {
                  await onLogout();
                  window.location.replace("/");
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

let packagesCache: TourPackage[] | null = null;
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** Packages mega menu — the real published trips (loaded once, on first open). */
function PackagesMega({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<TourPackage[] | null>(packagesCache);
  useEffect(() => {
    if (packagesCache) return;
    let alive = true;
    api<{ packages: TourPackage[] }>("/api/packages", { method: "GET" })
      .then((r) => {
        packagesCache = r.packages;
        if (alive) setList(r.packages);
      })
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);
  const trips = list || [];
  const featured = trips.find((p) => p.featured) || trips[0];
  const others = trips.filter((p) => p !== featured).slice(0, 4);
  const places = [...new Set(trips.flatMap((p) => p.destinations))].slice(0, 8);
  const basis = (p: TourPackage) => (p.pricingType === "per_couple" ? "per couple" : "per person");

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700"><Palmtree className="h-3.5 w-3.5" /> SKYO GETAWAYS · {trips.length || "…"} CURATED {trips.length === 1 ? "TRIP" : "TRIPS"}</div>
            <h2 className="mt-2 text-[25px] font-extrabold leading-tight tracking-tight">Find your kind of escape</h2>
            <p className="mt-1 text-xs text-muted">Day-by-day routes, clear prices and every inclusion before you book.</p>
          </div>
          <Link href="/packages" onClick={onClose} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110">Explore all trips<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {!list &&
            [0, 1].map((k) => <div key={k} className="h-[88px] animate-pulse rounded-2xl bg-white/80" />)}
          {(others.length ? others : featured ? [featured] : []).map((p) => (
            <Link key={p.id} href={`/packages/${p.slug}`} onClick={onClose} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#dce8d9] bg-white/90 p-2.5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_14px_35px_-24px_rgba(5,100,80,.42)]">
              <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-emerald-50 bg-cover bg-center" style={{ backgroundImage: `url("${p.coverPhoto}")` }}>
                <span className="absolute bottom-1 left-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-extrabold text-ink">{p.durationDays}D/{p.durationNights}N</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-extrabold leading-tight">{p.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">{p.destinations.join(" · ")}</span>
                <span className="mt-1 block text-[11px] font-bold text-emerald-800">{inr(p.discountedPrice)} <span className="font-medium text-muted">{basis(p)}</span></span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-700/60 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          ))}
          {[
            [CalendarDays, "Day-by-day itineraries", "See every stop before you book"],
            [ShieldCheck, "Clear trip details", "Inclusions, exclusions and policies"],
          ].map(([Icon, title, sub]) => {
            const I = Icon as typeof Ticket;
            return (
              <Link key={title as string} href="/packages" onClick={onClose} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#dce8d9] bg-white/70 p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-700 group-hover:text-white"><I className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0"><span className="block text-[13px] font-extrabold leading-tight">{title as string}</span><span className="mt-1 block text-[11px] leading-snug text-muted">{sub as string}</span></span>
              </Link>
            );
          })}
        </div>
        {places.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted"><MapPinned className="h-3.5 w-3.5" /> Places</span>
            {places.map((d) => (
              <Link key={d} href={`/packages?destination=${encodeURIComponent(d)}`} onClick={onClose} className="rounded-full border border-[#dce8d9] bg-white px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-emerald-400 hover:bg-emerald-700 hover:text-white">{d}</Link>
            ))}
          </div>
        )}
      </div>
      {featured ? (
        <Link href={`/packages/${featured.slug}`} onClick={onClose} className="group relative flex min-h-[290px] flex-col justify-end overflow-hidden rounded-[24px] bg-[#103c37] p-5 text-white">
          <div className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${featured.coverPhoto}")` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071c24]/95 via-[#102c31]/30 to-transparent" />
          <div className="relative">
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] backdrop-blur">{featured.featured ? "Most popular" : "Featured journey"}</span>
            <div className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{featured.title}</div>
            <div className="mt-1 truncate text-xs text-white/75">{featured.destinations.join(" · ")}</div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div><div className="text-[10px] text-white/60">{featured.durationDays} days · {featured.durationNights} nights · {basis(featured)}</div><div className="text-xl font-black">{inr(featured.discountedPrice)}</div></div>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-ink transition group-hover:bg-emerald-600 group-hover:text-white">View <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="min-h-[290px] animate-pulse rounded-[24px] bg-emerald-900/10" />
      )}
    </div>
  );
}
