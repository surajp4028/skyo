"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Armchair, BadgeCheck, Briefcase, ChevronDown, Clock, Luggage, Plane, Radio, ShieldCheck } from "lucide-react";
import { AirlineLogo } from "./airline-logo";
import { TerminalChip } from "./terminal-chip";
import { airlineInfo, CABIN_LABEL, type CabinKey } from "@/lib/flight/airlines";
import { fmtDur, groupAirfarePaise, type FlightLeg, type FlightOption, type PaxMix } from "@/lib/flight/model";
import { useSite } from "@/lib/client/providers";
import { paxText } from "./flight-search-bar";
import { fmtINR } from "@/lib/train/format";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = { scheduled: "On schedule", active: "In the air", landed: "Landed", cancelled: "Cancelled", diverted: "Diverted", incident: "Incident" };

export function FlightCard({ o, cabin, mix, onSelect, index = 0 }: { o: FlightOption; cabin: CabinKey; mix: PaxMix; onSelect: (cabin: CabinKey) => void; index?: number }) {
  const site = useSite();
  const group = mix.adults + mix.children + mix.infants;
  const [open, setOpen] = useState(false);
  const fare = o.fares[cabin] ?? o.fares.economy!;
  const shownCabin: CabinKey = o.fares[cabin] ? cabin : "economy";
  const first = o.legs[0];
  const last = o.legs[o.legs.length - 1];
  const airlines = [...new Set(o.legs.map((l) => l.airline.iata))];
  const st = first.status;
  const few = fare.seatsLeft > 0 && fare.seatsLeft <= 9;
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className="group relative overflow-hidden rounded-[26px] border border-white/70 bg-white/90 shadow-[0_20px_60px_-34px_rgba(10,15,31,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-34px_rgba(0,87,255,0.45)]"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_65%)] opacity-0 transition group-hover:opacity-100" />
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_190px] md:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="flex -space-x-2">{airlines.map((a) => <AirlineLogo key={a} iata={a} size={34} className="ring-2 ring-white" />)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold">{airlines.map((a) => airlineInfo(a).name).join(" + ")}</span>
              <span className="block truncate text-[11px] font-semibold text-muted">{o.legs.map((l) => `${l.airline.iata} ${l.number}`).join(" · ")} · {first.aircraft.name}</span>
            </span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {st && st.state !== "scheduled" && <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", st.state === "cancelled" ? "bg-red-50 text-red-600" : "bg-sky-50 text-sky-700")}><Radio className="h-3 w-3" />{STATUS[st.state] || st.state}</span>}
              {st?.delayMin ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">+{st.delayMin}m today</span> : null}
              {o.refundable && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><ShieldCheck className="h-3 w-3" />Refundable</span>}
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-left">
              <div className="text-2xl font-black tabular-nums tracking-tight sm:text-[28px]">{o.dep}</div>
              <div className="text-xs font-bold text-ink/70">{first.from.iata} <span className="font-semibold text-muted">· {first.from.city}</span></div>
              <TerminalChip t={first.from.terminal} />
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col items-center">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted"><Clock className="h-3 w-3" />{fmtDur(o.durationMin)}</span>
              <div className="relative h-[2px] w-full bg-[repeating-linear-gradient(90deg,#c7d2fe_0_6px,transparent_6px_11px)]">
                <span className="absolute -left-1 -top-[5px] h-3 w-3 rounded-full border-2 border-[#0057ff] bg-white" />
                <span className="absolute -right-1 -top-[5px] h-3 w-3 rounded-full bg-[#0057ff]" />
                {o.stops > 0 && <span className="absolute left-1/2 -top-[4px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-white" />}
                <motion.span className="absolute -top-[9px] text-[#0057ff]" initial={{ left: "8%" }} whileInView={{ left: "78%" }} transition={{ duration: 1.6, ease: "easeInOut" }} viewport={{ once: true }}>
                  <Plane className="h-5 w-5 rotate-0 fill-[#0057ff]" />
                </motion.span>
              </div>
              <span className={cn("mt-1.5 whitespace-nowrap text-[11px] font-bold", o.stops ? "text-amber-600" : "text-emerald-600")}>{o.stops ? `${o.stops} stop${o.stops > 1 ? "s" : ""} · ${o.legs.slice(0, -1).map((l) => l.to.iata).join(", ")}` : "Non-stop"}</span>
              {o.stops > 0 && <span className="whitespace-nowrap text-[10px] font-semibold text-muted">{o.layovers.map((x) => fmtDur(x)).join(" + ")} layover</span>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-black tabular-nums tracking-tight sm:text-[28px]">{o.arr}{o.dayOffset ? <sup className="ml-0.5 text-[11px] font-bold text-orange-500">+{o.dayOffset}</sup> : null}</div>
              <div className="text-xs font-bold text-ink/70"><span className="font-semibold text-muted">{last.to.city} · </span>{last.to.iata}</div>
              <TerminalChip t={last.to.terminal} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-dashed border-line pt-3 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="md:text-right">
            <div className="text-[11px] font-semibold text-muted">{CABIN_LABEL[shownCabin]} · per adult</div>
            <div className="text-[26px] font-black leading-none tracking-tight">{fmtINR(fare.perAdultPaise / 100)}</div>
            {group > 1 && <div className="text-[11px] font-semibold text-muted">{fmtINR(groupAirfarePaise(site, fare, mix, shownCabin) / 100)} · {paxText(mix.adults, mix.children, mix.infants)}</div>}
            {few && <div className="mt-0.5 text-[11px] font-bold text-orange-600">Only {fare.seatsLeft} seats left</div>}
          </div>
          <button onClick={() => onSelect(shownCabin)} className="group/b relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-6 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_-12px_rgba(0,87,255,0.85)] transition hover:-translate-y-0.5 active:scale-[0.98]">
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover/b:left-[120%] group-hover/b:opacity-100" />
            <span className="relative">Select →</span>
          </button>
        </div>
      </div>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between border-t border-line/70 bg-surface/50 px-5 py-2.5 text-xs font-bold text-ink/60 transition hover:text-[#0057ff]">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Luggage className="h-3.5 w-3.5" /> {o.baggage[shownCabin].checkIn} check-in</span>
          <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {o.baggage[shownCabin].cabin} cabin</span>
          {o.fares.business && <span className="hidden items-center gap-1 sm:flex"><Armchair className="h-3.5 w-3.5" /> Business from {fmtINR(o.fares.business.perAdultPaise / 100)}</span>}
        </span>
        <span className="flex items-center gap-1">Flight details <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-5 border-t border-line/70 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
              <Itinerary o={o} />
              <div className="space-y-3 text-xs">
                <div className="rounded-2xl bg-surface p-3">
                  <div className="mb-1.5 font-extrabold">Fare ({CABIN_LABEL[shownCabin]})</div>
                  <Row k="Base fare" v={fmtINR(fare.basePaise / 100)} />
                  <Row k="Taxes & airport fees" v={fmtINR(fare.taxesPaise / 100)} />
                  <Row k="Per adult" v={fmtINR(fare.perAdultPaise / 100)} bold />
                </div>
                <div className="rounded-2xl bg-surface p-3 text-muted">
                  <div className="mb-1 font-extrabold text-ink">Good to know</div>
                  <p>{o.refundable ? "Refundable with the airline's cancellation fee." : "Saver fare — cancellation fee applies, part refund."} Date change allowed with fare difference.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={cn("flex justify-between py-0.5", bold && "mt-1 border-t border-line pt-1.5 font-extrabold")}><span className={bold ? "" : "text-muted"}>{k}</span><span className="font-bold tabular-nums">{v}</span></div>;
}

/** Vertical timeline of segments with the layover between them. */
export function Itinerary({ o, dark }: { o: Pick<FlightOption, "legs" | "layovers">; dark?: boolean }) {
  return (
    <ol className="space-y-0">
      {o.legs.map((l, i) => (
        <li key={l.key}>
          <LegRow l={l} dark={dark} />
          {i < o.legs.length - 1 && (
            <div className={cn("my-2 ml-[18px] flex items-center gap-2 border-l-2 border-dashed py-2 pl-5 text-xs font-bold", dark ? "border-amber-300/50 text-amber-200" : "border-amber-300 text-amber-700")}>
              <Clock className="h-3.5 w-3.5" /> {fmtDur(o.layovers[i])} layover in {l.to.city} ({l.to.iata}) {l.airline.iata !== o.legs[i + 1].airline.iata && <span className="font-semibold opacity-80">· re-check bags, separate airlines</span>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function LegRow({ l, dark }: { l: FlightLeg; dark?: boolean }) {
  const mute = dark ? "text-white/55" : "text-muted";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <AirlineLogo iata={l.airline.iata} size={36} />
        <span className={cn("mt-1 w-px flex-1", dark ? "bg-white/15" : "bg-line")} />
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold">
          {l.airline.name} · {l.airline.iata} {l.number}
          <span className={cn("text-[11px] font-semibold", mute)}>{l.aircraft.name}</span>
        </div>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="font-black tabular-nums">{l.from.time}</span>
          <span><b>{l.from.city} ({l.from.iata})</b> <span className={mute}>· {l.from.airport}</span> <TerminalChip t={l.from.terminal} dark={dark} className="mt-0 align-middle" /></span>
          <span className={cn("font-semibold", mute)}>{fmtDur(l.durationMin)}</span>
          <span className={mute}>{l.distanceKm.toLocaleString("en-IN")} km{l.codeshares.length ? ` · also sold as ${l.codeshares.slice(0, 3).join(", ")}` : ""}</span>
          <span className="font-black tabular-nums">{l.to.time}{l.dayOffset ? <sup className="text-[9px] text-orange-500">+{l.dayOffset}</sup> : null}</span>
          <span><b>{l.to.city} ({l.to.iata})</b> <span className={mute}>· {l.to.airport}</span> <TerminalChip t={l.to.terminal} dark={dark} className="mt-0 align-middle" /></span>
        </div>
        {l.codeshares.length > 0 && <div className={cn("mt-1.5 flex items-center gap-1 text-[10px] font-semibold", mute)}><BadgeCheck className="h-3 w-3" /> Operated by {l.airline.name}</div>}
      </div>
    </div>
  );
}
