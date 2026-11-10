"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, BadgeCheck, BadgePercent, BookUser, Briefcase, ChevronDown, Crown, Download, FileText, Loader2, Lock, Luggage, MapPin, Plane, Plus, ShieldCheck, ShieldPlus, Trash2, Users, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { useAuth, useSite } from "@/lib/client/providers";
import { PassengerForm, genderLabel, type SavedPassenger } from "@/components/booking/passenger-form";
import { BillingFields, billingValid, GstPanel, useGstProfile, type Billing } from "@/components/booking/gst-panel";
import { DottedRouteMap } from "./dotted-route-map";
import { Itinerary } from "./flight-card";
import { AirlineLogo } from "./airline-logo";
import { TerminalChip } from "./terminal-chip";
import { SeatLegend, SeatMap, type SeatLeg } from "./seat-map";
import { CABIN_LABEL, type CabinKey } from "@/lib/flight/airlines";
import { flightCharges, flightInsuranceOffered, fmtDur, needsPassport, paxType, type FlightOption } from "@/lib/flight/model";
import { couponLabel, pctOf, type CouponRule } from "@/lib/charges-core";
import { fmtINR, fmtMoney, prettyDate } from "@/lib/train/format";
import { paxText, type FlightQuery } from "./flight-search-bar";
import { cn } from "@/lib/utils";

type Offer = { code: string; title: string | null; type: CouponRule["type"]; value: number; applyOn: CouponRule["applyOn"]; maxDiscount: number | null; minOrder: number | null; usesLeftForYou: number | null; personal?: boolean };
type Step = "travellers" | "seats" | "pay" | "paying" | "verifying" | "done" | "failed";
type Booking = { ref: string; status: string; ticketStatus: string; amount: number; pnr: string | null; details: { failure?: string; ticket?: { allocations: { name: string; seats: Record<string, string>; eticket: string }[] } } };
const STEPS: { key: Step; label: string }[] = [{ key: "travellers", label: "Travellers" }, { key: "seats", label: "Seats" }, { key: "pay", label: "Review & pay" }];

/** Flight booking: travellers → seat map → review & pay (Razorpay) → server verification → e-ticket. */
export function FlightSheet({ o, initialCabin, q, onClose }: { o: FlightOption; initialCabin: CabinKey; q: FlightQuery; onClose: () => void }) {
  const site = useSite();
  const { user } = useAuth();
  const maxPax = Number(site.max_passengers_per_flight) || 9;
  const [cabin, setCabin] = useState<CabinKey>(initialCabin);
  const fare = o.fares[cabin] ?? o.fares.economy!;
  const [step, setStep] = useState<Step>("travellers");
  const [list, setList] = useState<SavedPassenger[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [legs, setLegs] = useState<SeatLeg[] | null>(null);
  const [legIdx, setLegIdx] = useState(0);
  const [seats, setSeats] = useState<Record<string, string[]>>({});
  const offerInsurance = flightInsuranceOffered(site);
  const [insurance, setInsurance] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupon, setCoupon] = useState<Offer | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [gp, setGp] = useGstProfile();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [useGst, setUseGst] = useState(true);
  const [ticketEmail, setTicketEmail] = useState("");
  const [open, setOpen] = useState<"state" | "gst" | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const intl = needsPassport(o.legs);
  const [passports, setPassports] = useState<Record<string, { number: string; expiry: string; nationality: string }>>({});
  const ppLater = site.flight_passport_mode !== "booking";
  const [savePp, setSavePp] = useState(true);
  const ppFor = (id: number) => {
    const t = list?.find((x) => x.id === id);
    return passports[String(id)] ?? { number: t?.passport?.number ?? "", expiry: t?.passport?.expiry ?? "", nationality: t?.nationality || "IN" };
  };
  const ppBlank = (id: number) => !ppFor(id).number && !ppFor(id).expiry;
  const ppErr = (id: number) => {
    const p = ppFor(id);
    if (!/^[A-Z0-9]{6,9}$/.test(p.number)) return "Passport number: 6–9 letters / digits";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.expiry)) return "Add the expiry date";
    if (p.expiry <= q.date) return "Passport expires before the journey";
    if (!/^[A-Z]{2}$/.test(p.nationality)) return "Nationality: 2-letter code (IN)";
    return null;
  };
  // "add later" mode: blank is fine, but anything typed must be valid
  const passportsOk = !intl || sel.every((id) => !ppErr(id) || (ppLater && ppBlank(id)));
  const emailOk = !ticketEmail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ticketEmail);
  const bill: Billing = billing ?? gp?.billing ?? { state: "", pincode: null, address: null };
  const stateOk = billingValid(bill);
  const locked = step === "paying" || step === "verifying";
  const scroller = useRef<HTMLDivElement>(null);
  // the breakup closes by itself on the next step (it remembers which step opened it)
  const [breakupOn, setBreakupOn] = useState<Step | null>(null);
  const showBreakup = breakupOn === step;
  const setShowBreakup = (v: boolean | ((x: boolean) => boolean)) => setBreakupOn(() => ((typeof v === "function" ? v(showBreakup) : v) ? step : null));

  // the page behind must not scroll while the sheet is open (scrolling the seat map used to drag it to the footer)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  // every step starts at the top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    let alive = true;
    api<{ passengers: SavedPassenger[] }>("/api/account/passengers")
      .then((r) => {
        if (!alive) return;
        setList(r.passengers);
        // preselect saved travellers matching the search (adults, children, infants)
        const by = (t: string, n: number) => r.passengers.filter((p) => paxType(p.age) === t).slice(0, n).map((p) => p.id);
        setSel([...by("adult", q.adults), ...by("child", q.children), ...by("infant", q.infants)]);
      })
      .catch(() => alive && (setList([]), setNeedLogin(true)));
    api<{ coupons: Offer[] }>("/api/coupons?service=flight").then((r) => alive && setOffers(r.coupons)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [q.adults, q.children, q.infants]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !locked && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, locked]);
  // seat maps depend on the cabin
  useEffect(() => {
    let alive = true;
    api<{ legs: SeatLeg[] }>(`/api/flight/seats?${new URLSearchParams({ from: q.from, to: q.to, date: q.date, option: o.id, cabin })}`)
      .then((r) => alive && setLegs(r.legs))
      .catch((e) => alive && (setLegs([]), toast.error(errMsg(e))));
    return () => {
      alive = false;
    };
  }, [q.from, q.to, q.date, o.id, cabin]);

  // keep seat picks within the number of travellers
  const chosen = (list || []).filter((p) => sel.includes(p.id)).sort((a, b) => sel.indexOf(a.id) - sel.indexOf(b.id));
  const mix = { adults: chosen.filter((p) => paxType(p.age) === "adult").length, children: chosen.filter((p) => paxType(p.age) === "child").length, infants: chosen.filter((p) => paxType(p.age) === "infant").length };
  // infants ride on a lap: seats only for adults + children, in selection order
  const seatPax = chosen.filter((p) => paxType(p.age) !== "infant");
  const seatCount = seatPax.length;
  const mixError = !sel.length ? null : mix.adults < 1 ? "Add at least one adult (12+)" : mix.infants > mix.adults ? "One infant per adult — add another adult" : null;
  const seatPicks = useMemo(() => Object.fromEntries(Object.entries(seats).map(([k, v]) => [k, v.slice(0, seatCount)])), [seats, seatCount]);
  const seatFees = useMemo(() => {
    let sum = 0;
    for (const l of legs || []) for (const id of seatPicks[l.key] || []) sum += l.seats.find((s) => s.id === id)?.feePaise ?? 0;
    return sum;
  }, [legs, seatPicks]);
  const gstPct = cabin === "business" ? site.flight_gst_biz_pct : site.flight_gst_eco_pct;
  const gstPaise = pctOf(fare.basePaise, gstPct); // on the adult base fare (taxesPaise = airport + this)
  const charges = flightCharges(site as never, {
    fare: { basePaise: fare.basePaise, airportPaise: Math.max(0, fare.taxesPaise - gstPaise) }, pax: mix, cabin, seatFeesPaise: seatFees,
    seatNote: Object.values(seatPicks).flat().join(", ") || undefined, payMode: "upi", insurance: offerInsurance && insurance, coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value, applyOn: coupon.applyOn, maxDiscount: coupon.maxDiscount, minOrder: coupon.minOrder } : null,
  });
  const estimate = charges.totalPaise / 100;

  const applyCode = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const known = offers.find((x) => x.code === code);
    if (known) return (setCoupon(known), setCodeInput(""));
    setChecking(true);
    try {
      const r = await api<{ coupon: Offer }>("/api/coupons/check", { body: { code, service: "flight" } });
      setCoupon(r.coupon);
      setCodeInput("");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setChecking(false);
    }
  };
  const removePassenger = async (id: number) => {
    try {
      await api(`/api/account/passengers/${id}`, { method: "DELETE" });
      setList((l) => (l || []).filter((x) => x.id !== id));
      setSel((s) => s.filter((x) => x !== id));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setConfirmDel(null);
    }
  };
  const toggleSeat = (legKey: string, id: string) =>
    setSeats((s) => {
      const cur = s[legKey] || [];
      return { ...s, [legKey]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-seatCount) };
    });

  const pollBooking = async (r: string) => {
    for (let i = 0; i < 8; i++) {
      const x = await api<{ booking: Booking }>(`/api/bookings/${r}`).catch(() => null);
      if (x && (x.booking.ticketStatus !== "not_issued" || x.booking.status === "failed")) return x.booking;
      await new Promise((res) => setTimeout(res, 1200));
    }
    return (await api<{ booking: Booking }>(`/api/bookings/${r}`)).booking;
  };

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api<{ bookingRef: string; charges: { totalPaise: number }; checkout: Record<string, unknown> }>("/api/bookings/flight/initiate", {
        body: {
          optionId: o.id, from: q.from, to: q.to, date: q.date, cabin, passengerIds: sel, seats: seatPicks, payMode: "upi", insurance: offerInsurance && insurance,
          couponCode: charges.coupon?.code ?? null, billing: { state: bill.state, pincode: bill.pincode || null, address: bill.address || null }, useGst: !!gp?.gst && useGst,
          notifyEmail: user?.email ? null : ticketEmail || null,
          ...(intl ? { passports: Object.fromEntries(sel.filter((id) => !ppErr(id)).map((id) => [String(id), ppFor(id)])), savePassports: savePp } : {}),
        },
      });
      setRef(r.bookingRef);
      if (Math.abs(r.charges.totalPaise / 100 - estimate) >= 1) toast.info(`Total updated to ${fmtMoney(r.charges.totalPaise / 100)}`);
      setStep("paying");
      await openCheckout(r.checkout, {
        onSuccess: async (resp) => {
          setStep("verifying");
          try {
            await api("/api/bookings/flight/verify", { body: { bookingRef: r.bookingRef, ...resp } });
            const bk = await pollBooking(r.bookingRef);
            setBooking(bk);
            setStep(bk.ticketStatus === "issued" ? "done" : "failed");
            if (bk.ticketStatus !== "issued") setFailMsg(bk.details.failure || "Payment received, but the ticket couldn't be issued. A refund has been started.");
          } catch (e) {
            setFailMsg(errMsg(e));
            setStep("failed");
          }
        },
        onFailed: (x) => setFailMsg(x.error.description || "Payment failed."),
        onDismiss: () => {
          setStep((s) => (s === "paying" ? "pay" : s));
          toast.info("Payment not completed", { description: "Your seats are held for 15 minutes — resume from My trips." });
        },
      }).catch((e) => {
        setStep("pay");
        toast.error(errMsg(e));
      });
    } catch (e) {
      const msg = errMsg(e);
      if (/coupon/i.test(msg)) setCoupon(null);
      if (/seat/i.test(msg)) {
        setStep("seats");
        setSeats({});
        api<{ legs: SeatLeg[] }>(`/api/flight/seats?${new URLSearchParams({ from: q.from, to: q.to, date: q.date, option: o.id, cabin })}`).then((x) => setLegs(x.legs)).catch(() => {});
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const first = o.legs[0];
  const last = o.legs[o.legs.length - 1];
  const next = () => {
    if (step === "travellers") {
      if (!sel.length) return toast.error("Select at least one traveller");
      if (mixError) return toast.error(mixError);
      setStep("seats");
    } else if (step === "seats") setStep("pay");
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#050816]/70 backdrop-blur-sm" onClick={() => !locked && onClose()} />
      <motion.div initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative grid max-h-[96vh] w-full max-w-6xl grid-rows-[minmax(0,1fr)] overflow-hidden rounded-t-[28px] bg-white shadow-lift sm:rounded-[28px] lg:h-[92vh] lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* ---- dark side: route map + itinerary ---- */}
        <aside className="relative hidden min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-[radial-gradient(120%_80%_at_0%_0%,#1e3a8a_0%,#0b1020_55%,#050816_100%)] p-6 text-white lg:block">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" /></div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <AirlineLogo iata={first.airline.iata} size={42} />
              <div className="min-w-0">
                <div className="truncate font-extrabold">{[...new Set(o.legs.map((l) => l.airline.name))].join(" + ")}</div>
                <div className="text-xs text-white/60">{o.legs.map((l) => `${l.airline.iata} ${l.number}`).join(" · ")}</div>
              </div>
            </div>
            <div className="mt-5 rounded-3xl bg-white/[0.04] p-2 ring-1 ring-white/10"><DottedRouteMap theme="dark" codes={[first.from.iata, ...o.legs.slice(1).map((l) => l.from.iata), last.to.iata]} /></div>
            <div className="mt-5 flex items-end justify-between">
              <div><div className="text-3xl font-black">{o.dep}</div><div className="text-xs font-bold text-white/60">{first.from.iata} · {first.from.city}</div><TerminalChip t={first.from.terminal} dark /></div>
              <div className="pb-1 text-center text-[11px] font-bold text-white/60">{fmtDur(o.durationMin)}<div className={o.stops ? "text-amber-300" : "text-emerald-300"}>{o.stops ? `${o.stops} stop${o.stops > 1 ? "s" : ""}` : "Non-stop"}</div></div>
              <div className="text-right"><div className="text-3xl font-black">{o.arr}{o.dayOffset ? <sup className="text-xs text-orange-300">+{o.dayOffset}</sup> : null}</div><div className="text-xs font-bold text-white/60">{last.to.city} · {last.to.iata}</div><TerminalChip t={last.to.terminal} dark right /></div>
            </div>
            <div className="mt-2 text-xs text-white/60">{prettyDate(q.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            <div className="mt-6"><Itinerary o={o} dark /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"><Luggage className="mb-1 h-4 w-4 text-sky-300" /><div className="font-bold">{o.baggage[cabin].checkIn}</div><div className="text-white/50">Check-in</div></div>
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"><Briefcase className="mb-1 h-4 w-4 text-sky-300" /><div className="font-bold">{o.baggage[cabin].cabin}</div><div className="text-white/50">Cabin bag</div></div>
            </div>
          </div>
        </aside>

        {/* ---- steps ---- */}
        <section className="flex max-h-[96vh] min-h-0 flex-col">
          <header className="shrink-0 border-b border-line px-5 pb-3 pt-4">
            <div className="flex items-center gap-3">
              {(step === "seats" || step === "pay") && <button onClick={() => setStep(step === "pay" ? "seats" : "travellers")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><ArrowLeft className="h-4 w-4" /></button>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-extrabold">{first.from.city} → {last.to.city}</div>
                <div className="truncate text-xs text-muted">{prettyDate(q.date, { weekday: "short", day: "numeric", month: "short" })} · {o.dep} – {o.arr} · {o.legs.map((l) => `${l.airline.iata} ${l.number}`).join(" · ")}</div>
              </div>
              {!locked && <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface transition hover:rotate-90"><X className="h-5 w-5" /></button>}
            </div>
            {stepIdx >= 0 && (
              <div className="mt-3 flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex flex-1 items-center gap-2">
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black", i < stepIdx ? "bg-emerald-500 text-white" : i === stepIdx ? "bg-[#0057ff] text-white" : "bg-surface text-muted")}>{i < stepIdx ? "✓" : i + 1}</span>
                    <span className={cn("hidden text-xs font-bold sm:block", i === stepIdx ? "text-ink" : "text-muted")}>{s.label}</span>
                    {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", i < stepIdx ? "bg-emerald-400" : "bg-line")} />}
                  </div>
                ))}
              </div>
            )}
          </header>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <AnimatePresence mode="wait">
              {step === "travellers" && (
                <motion.div key="t" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 p-5">
                  {/* phones: the dark side panel is hidden, so the trip details live here */}
                  <details className="group overflow-hidden rounded-2xl border border-line lg:hidden">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                      <AirlineLogo iata={first.airline.iata} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">{o.dep} {first.from.iata} → {o.arr}{o.dayOffset ? `+${o.dayOffset}` : ""} {last.to.iata}</span>
                        <span className="block truncate text-[11px] font-semibold text-muted">{fmtDur(o.durationMin)} · {o.stops ? `${o.stops} stop${o.stops > 1 ? "s" : ""} via ${o.legs.slice(0, -1).map((l) => l.to.city).join(", ")}` : "Non-stop"} · {o.baggage[cabin].checkIn} bag</span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-line p-3">
                      <DottedRouteMap codes={[first.from.iata, ...o.legs.slice(1).map((l) => l.from.iata), last.to.iata]} />
                      <Itinerary o={o} />
                    </div>
                  </details>
                  {(o.fares.economy && o.fares.business) && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["economy", "business"] as CabinKey[]).map((c) => (
                        <button key={c} onClick={() => (setCabin(c), setSeats({}))} className={cn("rounded-2xl border-2 p-3 text-left transition", cabin === c ? "border-[#0057ff] bg-sky-50" : "border-line hover:border-ink/25")}>
                          <span className="flex items-center gap-1.5 text-sm font-extrabold">{c === "business" ? <Crown className="h-4 w-4 text-amber-500" /> : <Plane className="h-4 w-4 text-[#0057ff]" />}{CABIN_LABEL[c]}</span>
                          <span className="mt-0.5 block text-lg font-black">{fmtINR(o.fares[c]!.perAdultPaise / 100)}</span>
                          <span className="text-[11px] text-muted">per adult · {o.baggage[c].checkIn} bag</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {needLogin ? (
                    <div className="rounded-3xl border border-dashed border-line p-8 text-center">
                      <Users className="mx-auto h-8 w-8 text-[#0057ff]" />
                      <h3 className="mt-3 font-extrabold">Log in to book this flight</h3>
                      <p className="mt-1 text-sm text-muted">Your travellers, seats and tickets are saved to your SKYO account.</p>
                      <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/flights")}`} className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Log in</Link>
                    </div>
                  ) : (
                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-extrabold">Who&apos;s flying? <span className="text-xs font-semibold text-muted">({sel.length}/{maxPax})</span></h3>
                        {!adding && <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-bold text-[#0057ff]"><Plus className="h-3.5 w-3.5" /> Add traveller</button>}
                      </div>
                      <p className="mb-3 text-[11px] text-muted">Names must match the government ID you&apos;ll show at the airport.</p>
                      {adding && (
                        <div className="mb-3 rounded-2xl border border-line p-4">
                          <PassengerForm compact onCancel={() => setAdding(false)} onSaved={(p) => (setList((l) => [...(l || []), p]), setSel((s) => (s.length < maxPax && p.age >= 2 ? [...s, p.id] : s)), setAdding(false))} />
                        </div>
                      )}
                      {!list ? (
                        <div className="h-16 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />
                      ) : list.length === 0 && !adding ? (
                        <button onClick={() => setAdding(true)} className="w-full rounded-2xl border-2 border-dashed border-line p-5 text-sm font-bold text-muted hover:border-[#0057ff] hover:text-[#0057ff]">+ Add your first traveller</button>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {list.map((p) => {
                            const on = sel.includes(p.id);
                            const t = paxType(p.age);
                            const blocked = !on && (sel.length >= maxPax || (t === "infant" && mix.infants >= mix.adults));
                            return (
                              <div key={p.id} className={cn("flex items-center gap-2 rounded-2xl border-2 pr-2 transition", on ? "border-[#0057ff] bg-sky-50" : "border-line hover:border-ink/25", blocked && "opacity-40")}>
                                <button disabled={blocked} onClick={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", on ? "border-[#0057ff] bg-[#0057ff] text-white" : "border-ink/25")}>{on && <BadgeCheck className="h-3.5 w-3.5" />}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{p.name}</span>
                                    <span className="block text-[11px] text-muted">{p.age} yrs · {genderLabel(p.gender)} · <span className={cn("font-bold", t === "child" ? "text-violet-600" : t === "infant" ? "text-pink-600" : "")}>{t === "infant" ? "infant · on lap" : t === "child" ? `child · ${site.flight_child_discount_pct}% off fare` : "adult"}</span></span>
                                  </span>
                                </button>
                                {confirmDel === p.id ? (
                                  <span className="flex shrink-0 items-center gap-1">
                                    <button onClick={() => removePassenger(p.id)} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white">Delete</button>
                                    <button onClick={() => setConfirmDel(null)} className="rounded-lg px-2 py-1 text-[11px] font-bold text-muted">Keep</button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmDel(p.id)} aria-label={`Delete ${p.name}`} className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}
                </motion.div>
              )}

              {step === "seats" && (
                <motion.div key="s" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="min-h-full bg-[radial-gradient(100%_60%_at_50%_0%,#1f2a44_0%,#11151f_60%,#0b0d14_100%)] p-5 text-white">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-extrabold">Choose seats</h3>
                      <p className="text-xs text-white/60">Pick {seatCount} seat{seatCount > 1 ? "s" : ""}{mix.infants ? ` (infants sit on a lap)` : ""}{legs && legs.length > 1 ? " on each flight" : ""} — or skip and we&apos;ll assign free seats.</p>
                    </div>
                    <SeatLegend />
                  </div>
                  {legs && legs.length > 1 && (
                    <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
                      {legs.map((l, i) => (
                        <button key={l.key} onClick={() => setLegIdx(i)} className={cn("shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition", i === legIdx ? "bg-white text-ink" : "bg-white/10 text-white/70 hover:bg-white/15")}>
                          {l.from} → {l.to} · {l.flight} <span className="ml-1 opacity-60">{(seatPicks[l.key] || []).length}/{seatCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!legs ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>
                  ) : legs[legIdx] ? (
                    <>
                      <div className="mb-3 text-center text-xs text-white/50">{legs[legIdx].aircraft.name} · {legs[legIdx].flight}</div>
                      <SeatMap leg={legs[legIdx]} selected={seatPicks[legs[legIdx].key] || []} max={seatCount} onToggle={(id) => toggleSeat(legs[legIdx].key, id)} />
                    </>
                  ) : null}
                </motion.div>
              )}

              {step === "pay" && (
                <motion.div key="p" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 p-5">
                  <section className="rounded-2xl border border-line p-3">
                    <h3 className="mb-2 text-sm font-extrabold">Travellers & seats</h3>
                    <ul className="space-y-1.5 text-sm">
                      {chosen.map((p) => {
                        const si = seatPax.indexOf(p);
                        const t = paxType(p.age);
                        return (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold">{p.name} <span className="text-xs text-muted">· {p.age} yrs · {t}</span></span>
                            <span className="flex gap-1">{o.legs.map((l) => <span key={l.key} className={cn("rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold", t === "infant" ? "bg-pink-50 text-pink-700" : "bg-surface")}>{t === "infant" ? "On lap" : seatPicks[l.key]?.[si] || "Auto"}</span>)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  {intl && (
                    <section className="rounded-2xl border border-line p-3">
                      <h3 className="flex items-center gap-1.5 text-sm font-extrabold"><BookUser className="h-4 w-4 text-[#0057ff]" /> Passport details</h3>
                      <p className="mb-3 text-[11px] text-muted">
                        This trip leaves India — airlines need each traveller&apos;s passport (most countries want it valid 6 months beyond travel). {ppLater ? <b className="text-ink">Optional now — you can add it later from My trips before check-in.</b> : null} Stored encrypted, shared only with the airline.
                      </p>
                      <div className="space-y-3">
                        {chosen.map((p) => {
                          const v = ppFor(p.id);
                          const err = ppErr(p.id);
                          const upd = (k: "number" | "expiry" | "nationality", val: string) => setPassports((all) => ({ ...all, [String(p.id)]: { ...v, [k]: val } }));
                          return (
                            <div key={p.id} className="rounded-xl bg-surface p-3">
                              <div className="mb-2 text-xs font-bold">{p.name} <span className="font-semibold text-muted">· {p.age} yrs</span></div>
                              <div className="grid gap-2 sm:grid-cols-[1fr_150px_80px]">
                                <input value={v.number} onChange={(e) => upd("number", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9))} placeholder="Passport no." aria-label={`Passport number for ${p.name}`} className="h-10 rounded-lg border border-line bg-white px-3 font-mono text-sm uppercase outline-none focus:border-[#0057ff]" />
                                <input type="date" value={v.expiry} min={q.date} onChange={(e) => upd("expiry", e.target.value)} aria-label={`Passport expiry for ${p.name}`} className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-[#0057ff]" />
                                <input value={v.nationality} onChange={(e) => upd("nationality", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="IN" aria-label={`Nationality for ${p.name}`} className="h-10 rounded-lg border border-line bg-white px-3 text-center font-mono text-sm uppercase outline-none focus:border-[#0057ff]" />
                              </div>
                              {err && (v.number || v.expiry) && <p className="mt-1 text-[11px] font-semibold text-red-600">{err}</p>}
                              {p.passport && passports[String(p.id)] === undefined && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Filled from your saved traveller</p>}
                            </div>
                          );
                        })}
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={savePp} onChange={(e) => setSavePp(e.target.checked)} className="h-4 w-4 accent-[#0057ff]" /> Save passports to my traveller profiles</label>
                    </section>
                  )}
                  {offerInsurance && (
                    <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition", insurance ? "border-mint bg-mint/5" : "border-line")}>
                      <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} className="mt-1 h-4 w-4 accent-[#0057ff]" />
                      <span className="flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-bold"><ShieldPlus className="h-4 w-4 text-mint" /> Travel insurance</span>
                        <span className="block text-[11px] text-muted">{fmtINR(Number(site.flight_insurance_fee))} per traveller · flight delay, lost baggage and medical cover. Policy shared after booking.</span>
                      </span>
                    </label>
                  )}
                  {!user?.email && (
                    <div className="rounded-2xl border border-line p-3">
                      <label className="mb-1 block text-sm font-bold">Email for your e-ticket <span className="font-semibold text-muted">(optional)</span></label>
                      <input type="email" value={ticketEmail} onChange={(e) => setTicketEmail(e.target.value.trim())} placeholder="you@example.com" className={cn("h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none focus:border-[#0057ff]", emailOk ? "border-line" : "border-red-300")} />
                    </div>
                  )}
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <button onClick={() => setOpen(open === "state" ? null : "state")} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                      <MapPin className={cn("h-4 w-4", stateOk ? "text-[#0057ff]" : "text-amber-500")} />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Billing state</span><span className={cn("block truncate text-[11px]", stateOk ? "text-muted" : "font-semibold text-amber-600")}>{stateOk ? [bill.state, bill.pincode].filter(Boolean).join(" · ") : "Required — tap to select your state"}</span></span>
                      <ChevronDown className={cn("h-4 w-4 text-muted transition", open === "state" && "rotate-180")} />
                    </button>
                    {open === "state" && <div className="border-t border-line p-3"><BillingFields value={bill} onChange={setBilling} /></div>}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <button onClick={() => setOpen(open === "gst" ? null : "gst")} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                      <FileText className="h-4 w-4 text-[#0057ff]" />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Add GST for tax benefits <span className="font-semibold text-muted">(optional)</span></span><span className="block truncate text-[11px] text-muted">{gp?.gst ? `${gp.gst.company} · ${gp.gst.gstin}` : "Claim input tax credit on your invoice"}</span></span>
                      <ChevronDown className={cn("h-4 w-4 text-muted transition", open === "gst" && "rotate-180")} />
                    </button>
                    {open === "gst" && gp && (
                      <div className="space-y-3 border-t border-line p-3">
                        <GstPanel compact gst={gp.gst} mode={gp.mode} onChange={(g) => (setGp({ ...gp, gst: g }), setUseGst(true))} />
                        {gp.gst && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={useGst} onChange={(e) => setUseGst(e.target.checked)} className="h-4 w-4 accent-[#0057ff]" /> Use these GST details</label>}
                      </div>
                    )}
                  </div>
                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 font-extrabold"><BadgePercent className="h-4 w-4 text-[#0057ff]" /> Offers & coupons</h3>
                    {coupon ? (
                      <div className={cn("flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed p-3", charges.coupon ? "border-mint bg-mint/5" : "border-amber-300 bg-amber-50")}>
                        <div className="min-w-0"><div className="font-mono text-sm font-extrabold">{coupon.code}</div><div className="text-[11px] text-muted">{charges.coupon ? `${couponLabel(coupon)} · you save ${fmtMoney(charges.coupon.discountPaise / 100)}` : charges.couponError}</div></div>
                        <button onClick={() => setCoupon(null)} className="shrink-0 text-xs font-bold text-red-600">Remove</button>
                      </div>
                    ) : (
                      <>
                        <form onSubmit={(e) => (e.preventDefault(), applyCode(codeInput))} className="flex gap-2">
                          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={32} placeholder="Enter coupon code" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#0057ff]" />
                          <button type="submit" disabled={!codeInput || checking} className="rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}</button>
                        </form>
                        {offers.length > 0 && (
                          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                            {offers.slice(0, 4).map((x) => (
                              <button key={x.code} onClick={() => setCoupon(x)} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left transition hover:border-[#0057ff]">
                                <span className="min-w-0"><span className="font-mono text-xs font-extrabold">{x.code}</span>{x.personal && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">FOR YOU</span>}<span className="block truncate text-[11px] text-muted">{x.title || couponLabel(x)}</span></span>
                                <span className="shrink-0 text-xs font-bold text-[#0057ff]">Apply</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                  <section className="rounded-2xl bg-surface p-4">
                    <h3 className="mb-2 text-sm font-extrabold">Price details</h3>
                    <ul className="space-y-1.5 text-sm">
                      {charges.lines.map((l) => (
                        <li key={l.key} className="flex justify-between gap-3">
                          <span className="text-muted">{l.label}{l.note && (l.key === "fare" || l.key === "seats") ? <span className="block text-[10px]">{l.note}</span> : null}</span>
                          <span className={cn("font-semibold tabular-nums", l.paise < 0 && "text-mint")}>{l.paise < 0 ? `− ${fmtMoney(-l.paise / 100)}` : fmtMoney(l.paise / 100)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-end justify-between border-t border-line pt-2"><span className="font-bold">Total</span><span className="text-2xl font-extrabold">{fmtMoney(estimate)}</span></div>
                    <p className="mt-1 text-[11px] text-muted">The final amount is calculated on our server before payment — it can&apos;t be changed in the browser.</p>
                  </section>
                </motion.div>
              )}

              {(step === "paying" || step === "verifying") && (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center px-6 py-16 text-center">
                  <div className="relative h-20 w-20">
                    <span className="absolute inset-0 animate-ping rounded-full bg-sky-200/60" />
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0057ff] to-sky-400 text-white"><Plane className="h-9 w-9" /></span>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold">{step === "paying" ? "Complete payment in the Razorpay window" : "Confirming payment & issuing your e-ticket…"}</h3>
                  <p className="mt-1 text-sm text-muted">{step === "paying" ? "Your seats are held for 15 minutes." : "This takes a few seconds. Please don't refresh."}</p>
                  {failMsg && step === "paying" && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{failMsg} — you can retry in the payment window.</p>}
                </motion.div>
              )}

              {step === "done" && booking && (
                <motion.div key="d" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden px-6 py-10 text-center">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(56,189,248,0.25),transparent)]" />
                  <motion.div initial={{ x: -120, y: 40, rotate: -20, opacity: 0 }} animate={{ x: 0, y: 0, rotate: -12, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-indigo-100">
                    <Plane className="h-12 w-12 fill-[#0057ff] text-[#0057ff]" />
                  </motion.div>
                  <h3 className="relative mt-5 text-2xl font-black">Booking confirmed!</h3>
                  <p className="relative mt-1 text-sm text-muted">Your trip is all set. E-ticket sent by SMS / email.</p>
                  <div className="relative mt-4 inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-2 font-mono text-lg font-extrabold tracking-[0.2em] text-white">PNR {booking.pnr}</div>
                  <div className="relative mx-auto mt-5 max-w-md space-y-1.5 text-left">
                    {booking.details.ticket?.allocations.map((a, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm">
                        <span className="font-bold">{a.name}</span>
                        <span className="font-mono text-xs font-extrabold text-[#0057ff]">{Object.values(a.seats).join(" / ")}</span>
                      </div>
                    ))}
                  </div>
                  <p className="relative mt-3 text-xs text-muted">Booking {booking.ref} · Paid {fmtMoney(booking.amount)}</p>
                </motion.div>
              )}

              {step === "failed" && (
                <motion.div key="f" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-12 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-red-500 text-white"><AlertTriangle className="h-8 w-8" /></span>
                  <h3 className="mt-5 text-xl font-extrabold">We couldn&apos;t complete this booking</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{failMsg}</p>
                  <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-surface px-4 py-3 text-xs text-muted">If money was debited, it is refunded automatically to the same account in 5–7 working days. Track it in My account → Transactions.</p>
                  {ref && <p className="mt-2 text-xs text-muted">Reference {ref}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <footer className="relative shrink-0 border-t border-line p-4">
            <AnimatePresence>
              {showBreakup && sel.length > 0 && (step === "travellers" || step === "seats" || step === "pay") && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute inset-x-3 bottom-full mb-2 rounded-2xl border border-line bg-white p-4 shadow-[0_-20px_50px_-20px_rgba(10,15,31,0.35)]">
                  <div className="mb-2 flex items-center justify-between"><span className="text-sm font-extrabold">Price breakup · {sel.length} traveller{sel.length > 1 ? "s" : ""}</span><button onClick={() => setShowBreakup(false)} aria-label="Close breakup"><X className="h-4 w-4 text-muted" /></button></div>
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
                    {charges.lines.map((l) => (
                      <li key={l.key} className="flex justify-between gap-3">
                        <span className="text-muted">{l.label}{l.note && ["fare", "seats", "agent_fee", "insurance", "airport_fee"].includes(l.key) ? <span className="block text-[10px]">{l.note}</span> : null}</span>
                        <span className={cn("font-semibold tabular-nums", l.paise < 0 && "text-mint")}>{l.paise < 0 ? `− ${fmtMoney(-l.paise / 100)}` : fmtMoney(l.paise / 100)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between border-t border-line pt-2 font-extrabold"><span>Total</span><span>{fmtMoney(estimate)}</span></div>
                </motion.div>
              )}
            </AnimatePresence>
            {(step === "travellers" || step === "seats") && !needLogin && (
              <div className="flex items-center gap-3">
                <button type="button" disabled={!sel.length} onClick={() => setShowBreakup((v) => !v)} className="min-w-0 flex-1 text-left">
                  <div className={cn("text-[11px] font-semibold", mixError ? "text-red-600" : "text-muted")}>{mixError || (sel.length ? paxText(mix.adults, mix.children, mix.infants) : "No travellers")}{!mixError && seatFees ? ` · seats ${fmtINR(seatFees / 100)}` : ""}</div>
                  <div className="flex items-center gap-1 text-xl font-black">{sel.length ? fmtMoney(estimate) : fmtINR(fare.perAdultPaise / 100)}<span className="text-xs font-semibold text-muted">{sel.length ? " total" : " / adult"}</span>{sel.length > 0 && <ChevronDown className={cn("h-4 w-4 text-[#0057ff] transition", !showBreakup && "rotate-180")} />}</div>
                  {sel.length > 0 && <div className="text-[10px] font-bold text-[#0057ff]">{showBreakup ? "Hide" : "View"} price breakup</div>}
                </button>
                {step === "seats" && <button onClick={() => (setSeats({}), setStep("pay"))} className="shrink-0 rounded-2xl px-2 py-3 text-sm font-bold text-muted hover:bg-surface sm:px-4">Skip</button>}
                <button onClick={next} disabled={!sel.length || !!mixError} className="shrink-0 rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-4 py-3 sm:px-6 text-sm font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(0,87,255,0.85)] transition hover:-translate-y-0.5 disabled:opacity-50">
                  {step === "travellers" ? "Choose seats →" : "Continue →"}
                </button>
              </div>
            )}
            {step === "pay" && (
              <button onClick={() => (stateOk ? pay() : setOpen("state"))} disabled={busy || !sel.length || !emailOk || !passportsOk} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] py-3.5 text-base font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(0,87,255,0.85)] transition hover:-translate-y-0.5 disabled:opacity-50">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
                {!stateOk ? "Select your billing state" : !passportsOk ? "Add passport details" : `Pay ${fmtMoney(estimate)} securely`}
              </button>
            )}
            {step === "done" && booking && (
              <div className="grid grid-cols-2 gap-2">
                <a href={`/api/bookings/${booking.ref}/ticket`} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] py-3 text-sm font-extrabold text-white"><Download className="h-4 w-4" /> E-ticket (PDF)</a>
                <Link href="/account?tab=trips" className="flex items-center justify-center rounded-2xl border border-line py-3 text-sm font-bold">My trips</Link>
              </div>
            )}
            {step === "failed" && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => (setStep("pay"), setFailMsg(null))} className="rounded-2xl border border-line py-3 text-sm font-bold">Try again</button>
                <Link href="/contact" className="flex items-center justify-center rounded-2xl bg-ink py-3 text-sm font-bold text-white">Contact support</Link>
              </div>
            )}
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-mint" /> Payments by Razorpay · seats held 15 min while you pay</p>
          </footer>
        </section>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
