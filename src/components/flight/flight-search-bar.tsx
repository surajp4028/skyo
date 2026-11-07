"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Crown, Minus, Plane, Plus, Radar, Search, Users } from "lucide-react";
import { AirportInput } from "./airport-input";
import { DatePicker, toISO } from "@/components/ui/date-picker";
import { parseAirportInput } from "@/lib/flight/airports";
import { readRecentFlightSearch, saveRecentFlightSearch } from "@/lib/client/recent-flight";
import { useSite } from "@/lib/client/providers";
import { cn } from "@/lib/utils";

export type FlightQuery = { from: string; to: string; fromLabel: string; toLabel: string; date: string; cabin: "economy" | "business"; adults: number };

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Flight search: home widget (restores the last search) and the results page header. */
export function FlightSearchBar({ initial, compact }: { initial?: FlightQuery; compact?: boolean }) {
  const router = useRouter();
  const site = useSite();
  const maxPax = Number(site.max_passengers_per_flight) || 9;
  const [from, setFrom] = useState(initial?.fromLabel ?? "New Delhi (DEL)");
  const [to, setTo] = useState(initial?.toLabel ?? "Mumbai (BOM)");
  const [date, setDate] = useState(initial?.date ?? addDays(3));
  const [cabin, setCabin] = useState<FlightQuery["cabin"]>(initial?.cabin ?? "economy");
  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [paxOpen, setPaxOpen] = useState(false);
  const [recent, setRecent] = useState(false);
  const paxBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) return;
    const r = readRecentFlightSearch();
    if (!r) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore of a saved search */
    setFrom(r.fromLabel);
    setTo(r.toLabel);
    setDate(r.date >= addDays(0) ? r.date : addDays(1));
    setCabin(r.cabin);
    setAdults(Math.min(maxPax, Math.max(1, r.adults || 1)));
    setRecent(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !paxBox.current?.contains(e.target as Node) && setPaxOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const f = parseAirportInput(from);
    const t = parseAirportInput(to);
    if (!f || !t) return toast.error("Pick both airports from the suggestions");
    if (f === t) return toast.error("From and To can't be the same");
    saveRecentFlightSearch({ fromLabel: from, toLabel: to, date, cabin, adults });
    router.push(`/flights?${new URLSearchParams({ from: f, to: t, date, cabin, adults: String(adults) })}`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <AirportInput label="From" kind="from" value={from} onChange={(l) => setFrom(l)} />
        <button type="button" onClick={() => (setFrom(to), setTo(from))} aria-label="Swap" className="z-10 -my-3 mx-auto flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-line bg-white text-[#0057ff] shadow-soft transition hover:rotate-180 hover:border-[#0057ff] md:-mx-4 md:my-0">
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <AirportInput label="To" kind="to" value={to} onChange={(l) => setTo(l)} />
        <DatePicker label="Departure" value={date} onChange={setDate} className="md:max-w-[210px]" />
        <div ref={paxBox} className="relative md:max-w-[210px] md:flex-1">
          <button type="button" onClick={() => setPaxOpen((o) => !o)} className="flex h-full min-h-[74px] w-full flex-col justify-center rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:border-ink/20">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Users className="h-3.5 w-3.5" /> Travellers & class</span>
            <span className="mt-1 truncate text-[17px] font-bold">{adults} traveller{adults > 1 ? "s" : ""} <span className="text-sm font-semibold text-muted">· {cabin === "business" ? "Business" : "Economy"}</span></span>
          </button>
          {paxOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(10,15,31,0.35)]">
              <div className="flex items-center justify-between">
                <span><span className="block text-sm font-bold">Travellers</span><span className="text-[11px] text-muted">Age 2 and above</span></span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setAdults((a) => Math.max(1, a - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center font-extrabold">{adults}</span>
                  <button type="button" onClick={() => setAdults((a) => Math.min(maxPax, a + 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Plus className="h-3.5 w-3.5" /></button>
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["economy", "business"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCabin(c)} className={cn("flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition", cabin === c ? "border-[#0057ff] bg-sky-50 text-[#0057ff]" : "border-line text-ink/60")}>
                    {c === "business" ? <Crown className="h-4 w-4" /> : <Plane className="h-4 w-4" />} {c === "business" ? "Business" : "Economy"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPaxOpen(false)} className="mt-3 w-full rounded-xl bg-ink py-2 text-sm font-bold text-white">Done</button>
            </div>
          )}
        </div>
        <button type="submit" className="group flex h-[74px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-8 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(0,87,255,0.75)] transition hover:brightness-110 active:scale-[0.98]">
          <Search className="h-5 w-5 transition group-hover:scale-110" /> {compact ? "Modify" : "Search flights"}
        </button>
      </div>
      {!compact && (
        <div className="flex flex-col justify-between gap-3 px-1 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {[["Today", 0], ["Tomorrow", 1], ["This weekend", ((6 - new Date().getDay() + 7) % 7) || 7]].map(([l, n]) => (
              <button key={l} type="button" onClick={() => setDate(addDays(n as number))} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", date === addDays(n as number) ? "bg-ink text-white" : "bg-surface text-ink/60 hover:text-ink")}>{l}</button>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-line md:block" />
            {[["DEL", "BOM"], ["BLR", "DEL"], ["BOM", "GOI"], ["DEL", "SXR"]].map(([a, b]) => (
              <button key={a + b} type="button" onClick={() => (setFrom(`${a === "DEL" ? "New Delhi" : a === "BOM" ? "Mumbai" : "Bengaluru"} (${a})`), setTo(`${{ BOM: "Mumbai", DEL: "New Delhi", GOI: "Goa", SXR: "Srinagar" }[b]} (${b})`))} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/60 transition hover:border-[#0057ff] hover:text-[#0057ff]">
                {a} → {b}
              </button>
            ))}
          </div>
          <div className="flex gap-2 text-xs font-bold">
            {site.flight_live === "on" && <Link href="/flights/status" className="flex items-center gap-1.5 rounded-full bg-sky/10 px-3 py-1.5 text-sky-600"><Radar className="h-3.5 w-3.5" /> Flight status</Link>}
            {recent && <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-ink/60">Your last search</span>}
          </div>
        </div>
      )}
    </form>
  );
}
