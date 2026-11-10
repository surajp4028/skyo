"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StationInput } from "@/components/train/station-input";
import { parseStationInput } from "@/lib/train/stations";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeftRight, BusFront, Building2, CalendarDays, CloudSun, MapPin, Moon, Palmtree, Plane, Search, Sun, Sunrise, TrainFront, Users, Ticket, Radio, Armchair } from "lucide-react";
import { DatePicker, toISO } from "@/components/ui/date-picker";
import { useSite } from "@/lib/client/providers";
import { isPnrOn, isServiceOn, isTrainLiveOn } from "@/lib/services";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { cn } from "@/lib/utils";
import { readRecentTrainSearch, saveRecentTrainSearch } from "@/lib/client/recent-search";
import { FlightSearchBar } from "@/components/flight/flight-search-bar";

type Tab = "train" | "flight" | "bus" | "hotel" | "package";
const TABS: { value: Tab; label: string; icon: ReactNode }[] = [
  { value: "train", label: "Trains", icon: <TrainFront className="h-4 w-4" /> },
  { value: "flight", label: "Flights", icon: <Plane className="h-4 w-4" /> },
  { value: "bus", label: "Buses", icon: <BusFront className="h-4 w-4" /> },
  { value: "hotel", label: "Hotels", icon: <Building2 className="h-4 w-4" /> },
  { value: "package", label: "Packages", icon: <Palmtree className="h-4 w-4" /> },
];

const CITIES = ["Delhi", "Mumbai", "Bengaluru", "Kolkata", "Chennai", "Hyderabad", "Pune", "Goa", "Jaipur", "Ahmedabad", "Lucknow", "Kochi", "Srinagar", "Manali", "Udaipur", "Varanasi"];

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d); // local calendar date (IST), not UTC
};

export function SearchWidget() {
  const site = useSite();
  const tabs = TABS.filter((x) => isServiceOn(site, x.value));
  const t = useSearchParams().get("tab");
  if (!tabs.length) return <div className="rounded-[28px] bg-white p-8 text-center font-semibold text-muted shadow-lift">Bookings are paused right now. Please check back soon.</div>;
  const initial: Tab = tabs.some((x) => x.value === t) ? (t as Tab) : tabs[0].value;
  // remount when the navbar deep-links to another tab (?tab=flight)
  return <SearchWidgetInner key={initial} initial={initial} tabs={tabs} />;
}

function SearchWidgetInner({ initial, tabs }: { initial: Tab; tabs: typeof TABS }) {
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div id="search" className="relative scroll-mt-28 rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-[0_40px_120px_-30px_rgba(10,15,31,0.45)] backdrop-blur-2xl md:p-4">
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <AnimatedTabs tabs={tabs} value={tab} onChange={setTab} layoutId="search-tab" />
        <span className="hidden items-center gap-1.5 rounded-full bg-mint/10 px-3 py-1.5 text-xs font-bold text-mint md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Zero convenience fee on UPI
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === "train" && <TrainForm />}
          {tab === "flight" && <FlightForm />}
          {tab === "bus" && <BusForm />}
          {tab === "hotel" && <HotelForm />}
          {tab === "package" && <PackageForm />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------- building blocks ---------------------------- */

function Box({ label, icon, children, className }: { label: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("group relative flex min-w-0 flex-1 cursor-text flex-col justify-center rounded-2xl border border-line bg-white px-4 py-3 transition hover:border-ink/20 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10", className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
const inputCls = "mt-1 w-full min-w-0 bg-transparent text-[17px] font-bold text-ink outline-none placeholder:font-semibold placeholder:text-ink/30";

function Place({ label, value, onChange, list, placeholder }: { label: string; value: string; onChange: (v: string) => void; list: string; placeholder: string }) {
  return (
    <Box label={label} icon={<MapPin className="h-3.5 w-3.5" />}>
      <input list={list} value={value} onChange={(e) => onChange(e.target.value.slice(0, 60))} placeholder={placeholder} className={inputCls} autoComplete="off" />
    </Box>
  );
}

function Swap({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Swap" className="z-10 -my-3 mx-auto flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-line bg-white text-brand shadow-soft transition hover:rotate-180 hover:border-brand md:-mx-4 md:my-0">
      <ArrowLeftRight className="h-4 w-4" />
    </button>
  );
}

function Chips<T extends string>({ items, value, onChange }: { items: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-bold transition", value === i ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-ink/60 hover:border-ink/30")}>
          {i}
        </button>
      ))}
    </div>
  );
}

function SearchBtn({ label }: { label: string }) {
  return (
    <button type="submit" className="group flex h-[74px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-8 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,90,31,0.8)] transition hover:brightness-110 active:scale-[0.98] md:w-auto">
      <Search className="h-5 w-5 transition group-hover:scale-110" />
      {label}
    </button>
  );
}

function soon(service: string, ok: boolean, why?: string) {
  if (!ok) return toast.error(why || "Please fill all the details");
  toast.info(`${service} search is launching soon`, { description: "We're integrating live inventory — you'll be able to book right here." });
}

/* --------------------------------- forms --------------------------------- */

function TrainForm() {
  const router = useRouter();
  const trainSite = useSite();
  const liveOn = isTrainLiveOn(trainSite);
  const pnrOn = isPnrOn(trainSite);
  const [from, setFrom] = useState("New Delhi (NDLS)");
  const [to, setTo] = useState("Mumbai Central (MMCT)");
  const [date, setDate] = useState(() => addDays(1));
  const [quota, setQuota] = useState<"General" | "Tatkal" | "Ladies" | "Senior Citizen">("General");
  const [slots, setSlots] = useState<string[]>([]);
  const QUOTA_CODE = { General: "GN", Tatkal: "TQ", Ladies: "LD", "Senior Citizen": "SS" } as const;
  const [recent, setRecent] = useState(false);
  // Prefill with the traveller's last search (read after mount — localStorage isn't available on the server)
  useEffect(() => {
    const r = readRecentTrainSearch();
    if (!r) return;
    const quotaName = (Object.entries(QUOTA_CODE).find(([, c]) => c === r.quota)?.[0] ?? "General") as keyof typeof QUOTA_CODE;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore of a saved search */
    setFrom(r.fromLabel);
    setTo(r.toLabel);
    setDate(r.date >= addDays(0) ? r.date : addDays(1));
    setQuota(quotaName);
    setRecent(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = parseStationInput(from);
        const t = parseStationInput(to);
        if (!f || !t) return toast.error("Pick both stations from the suggestions");
        if (f === t) return toast.error("From and To can't be the same");
        saveRecentTrainSearch({ fromLabel: from, toLabel: to, date, quota: QUOTA_CODE[quota] });
        router.push(`/trains?${new URLSearchParams({ from: f, to: t, date, quota: QUOTA_CODE[quota], fl: from, tl: to, ...(slots.length ? { slots: slots.join(",") } : {}) })}`);
      }}
      className="space-y-3"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <StationInput label="From" value={from} onChange={(l) => setFrom(l)} />
        <Swap onClick={() => (setFrom(to), setTo(from))} />
        <StationInput label="To" value={to} onChange={(l) => setTo(l)} />
        <DatePicker label="Departure" value={date} onChange={setDate} className="md:max-w-[210px]" />
        <SearchBtn label="Search Trains" />
      </div>
      <div className="flex flex-col justify-between gap-3 px-1 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Chips items={["General", "Tatkal", "Ladies", "Senior Citizen"] as ("General" | "Tatkal" | "Ladies" | "Senior Citizen")[]} value={quota} onChange={setQuota} />
          <span className="mx-1 hidden h-4 w-px bg-line md:block" />
          {[["Today", 0], ["Tomorrow", 1], ["Day after", 2]].map(([l, n]) => (
            <button key={l} type="button" onClick={() => setDate(addDays(n as number))} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", date === addDays(n as number) ? "bg-ink text-white" : "bg-surface text-ink/60 hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-xs font-bold">
          {pnrOn && <Link href="/trains/pnr" className="flex items-center gap-1.5 rounded-full bg-iris/10 px-3 py-1.5 text-iris"><Ticket className="h-3.5 w-3.5" /> PNR status</Link>}
          {liveOn && <Link href="/trains/live" className="flex items-center gap-1.5 rounded-full bg-sky/10 px-3 py-1.5 text-sky-600"><Radio className="h-3.5 w-3.5" /> Running status</Link>}
          {recent && <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-ink/60">Your last search</span>}
        </div>
      </div>
      <div className="px-1"><TimeSlots value={slots} onChange={setSlots} /></div>
    </form>
  );
}

function FlightForm() {
  return <FlightSearchBar />;
}

function BusForm() {
  const [from, setFrom] = useState("Bengaluru");
  const [to, setTo] = useState("Goa");
  const [date, setDate] = useState(() => addDays(1));
  const [kind, setKind] = useState<"Any" | "AC" | "Sleeper" | "Volvo">("Any");
  const [slots, setSlots] = useState<string[]>([]);
  return (
    <form onSubmit={(e) => (e.preventDefault(), soon("Bus", !!from && !!to && from !== to))} className="space-y-3">
      <datalist id="bcities">{CITIES.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <Place label="From" value={from} onChange={setFrom} list="bcities" placeholder="Leaving from" />
        <Swap onClick={() => (setFrom(to), setTo(from))} />
        <Place label="To" value={to} onChange={setTo} list="bcities" placeholder="Going to" />
        <DatePicker label="Travel date" value={date} onChange={setDate} className="md:max-w-[210px]" />
        <SearchBtn label="Search Buses" />
      </div>
      <div className="flex flex-wrap items-center gap-3 px-1">
        <Armchair className="h-4 w-4 text-muted" />
        <Chips items={["Any", "AC", "Sleeper", "Volvo"] as ("Any" | "AC" | "Sleeper" | "Volvo")[]} value={kind} onChange={setKind} />
        <span className="mx-1 hidden h-4 w-px bg-line lg:block" />
        <TimeSlots value={slots} onChange={setSlots} />
      </div>
    </form>
  );
}

function HotelForm() {
  const [city, setCity] = useState("Goa");
  const [inD, setIn] = useState(() => addDays(7));
  const [outD, setOut] = useState(() => addDays(9));
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  return (
    <form onSubmit={(e) => (e.preventDefault(), soon("Hotel", !!city && outD > inD, outD <= inD ? "Check-out must be after check-in" : undefined))} className="space-y-3">
      <datalist id="hcities">{CITIES.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <Place label="City, area or hotel" value={city} onChange={setCity} list="hcities" placeholder="Where to?" />
        <DatePicker label="Check-in" value={inD} onChange={setIn} endLabel="Check-out" endValue={outD} onEndChange={(v) => setOut(v || addDaysTo(inD, 1))} className="md:max-w-[340px]" />
        <Box label="Rooms & guests" icon={<Users className="h-3.5 w-3.5" />} className="md:max-w-[220px]">
          <div className="mt-1 flex items-center gap-3 text-sm font-bold">
            <Counter v={rooms} set={setRooms} min={1} max={8} label="Room" />
            <Counter v={guests} set={setGuests} min={1} max={24} label="Guest" />
          </div>
        </Box>
        <SearchBtn label="Search Hotels" />
      </div>
    </form>
  );
}

function Counter({ v, set, min, max, label }: { v: number; set: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <button type="button" onClick={() => set(Math.max(min, v - 1))} className="h-6 w-6 rounded-full bg-surface">−</button>
      <span>{v} {label}{v > 1 ? "s" : ""}</span>
      <button type="button" onClick={() => set(Math.min(max, v + 1))} className="h-6 w-6 rounded-full bg-surface">+</button>
    </span>
  );
}

function PackageForm() {
  const [dest, setDest] = useState("Kashmir");
  const [month, setMonth] = useState(() => addDays(30).slice(0, 7));
  const [theme, setTheme] = useState<"Honeymoon" | "Family" | "Adventure" | "Pilgrimage" | "Beach">("Family");
  return (
    <form onSubmit={(e) => (e.preventDefault(), soon("Holiday package", !!dest))} className="space-y-3">
      <datalist id="pcities">{["Kashmir", "Kerala", "Goa", "Manali", "Andaman", "Rajasthan", "Ladakh", "Bali", "Dubai", "Thailand", "Maldives", "Vietnam"].map((s) => <option key={s} value={s} />)}</datalist>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <Place label="Destination" value={dest} onChange={setDest} list="pcities" placeholder="Where do you dream of?" />
        <Box label="Month of travel" icon={<CalendarDays className="h-3.5 w-3.5" />} className="md:max-w-[220px]">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={cn(inputCls, "text-[15px]")} />
        </Box>
        <SearchBtn label="Explore Packages" />
      </div>
      <div className="px-1"><Chips items={["Family", "Honeymoon", "Adventure", "Pilgrimage", "Beach"] as ("Honeymoon" | "Family" | "Adventure" | "Pilgrimage" | "Beach")[]} value={theme} onChange={setTheme} /></div>
    </form>
  );
}

const addDaysTo = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + n));
};

const SLOTS = [
  { key: "early", label: "Early", range: "12a–6a", icon: Sunrise },
  { key: "morning", label: "Morning", range: "6a–12p", icon: Sun },
  { key: "afternoon", label: "Afternoon", range: "12p–6p", icon: CloudSun },
  { key: "night", label: "Night", range: "6p–12a", icon: Moon },
];

/** Departure-time preference (multi-select). */
function TimeSlots({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Departure time</span>
      <div className="flex gap-1 rounded-2xl bg-surface p-1">
        {SLOTS.map((s) => {
          const on = value.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== s.key) : [...value, s.key])}
              className={cn(
                "group flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left transition",
                on ? "bg-white text-ink shadow-[0_2px_10px_-4px_rgba(10,15,31,0.25)] ring-1 ring-brand/40" : "text-ink/55 hover:text-ink",
              )}
            >
              <s.icon className={cn("h-4 w-4 transition", on ? "text-brand" : "group-hover:text-brand")} />
              <span className="leading-tight">
                <span className="block text-[11px] font-bold">{s.label}</span>
                <span className="block text-[10px] font-medium opacity-70">{s.range}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
