"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BusFront, Building2, ChevronDown, CreditCard, Download, FileText, Loader2, Ticket, Palmtree, Plane, Radar, ShieldPlus, TrainFront, Utensils } from "lucide-react";
import { AirlineLogo } from "@/components/flight/airline-logo";
import { api, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { CLASS_NAMES, fmtMoney as fmtINR, prettyDate } from "@/lib/train/format";
import { cn } from "@/lib/utils";
import { useSite } from "@/lib/client/providers";
import { isServiceOn, type ServiceKey } from "@/lib/services";

const SERVICE_TABS: { key: ServiceKey | ""; label: string; icon?: typeof Plane }[] = [
  { key: "", label: "All" },
  { key: "train", label: "Trains", icon: TrainFront },
  { key: "flight", label: "Flights", icon: Plane },
  { key: "bus", label: "Buses", icon: BusFront },
  { key: "hotel", label: "Hotels", icon: Building2 },
  { key: "package", label: "Packages", icon: Palmtree },
];
const PERIODS = [
  { key: "all", label: "All time" },
  { key: "upcoming", label: "Upcoming" },
  { key: "90", label: "Last 90 days" },
  { key: "180", label: "Last 6 months" },
] as const;

type Trip = {
  ref: string; service: string; status: string; paymentStatus: string; ticketStatus: string; amount: number; createdAt: string; holdExpiresAt: string | null; pnr: string | null;
  train: { number: string; name: string }; from: string; to: string; date: string; cls: string; quota: string; food: boolean;
  passengers: { name: string; age: number; gender: string }[];
  ticket: { pnr: string; hasProviderPdf?: boolean; allocations: { name: string; status: string; coach?: string; berth?: number; berthType?: string }[] } | null;
  gst?: { gstin: string; company: string } | null;
  refund?: { amount: number; pending: boolean } | null;
  failure?: string | null;
  charges: { lines: { key: string; label: string; paise: number; note?: string }[]; totalPaise: number; payMode: string } | null;
  insurance: { opted: boolean; total: number } | null;
  flight?: {
    legs: { key: string; airline: { iata: string; name: string }; number: string; from: { iata: string; city: string; time: string; terminal: string | null }; to: { iata: string; city: string; time: string; terminal: string | null }; durationMin: number }[];
    dep: string; arr: string; dayOffset: number; stops: number; durationMin: number; cabin: string;
    passengers: { name: string; seats: Record<string, string | null> }[];
    allocations: { name: string; seats: Record<string, string>; eticket: string }[] | null;
  } | null;
};
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

const STATUS: Record<string, [string, string]> = {
  confirmed: ["Confirmed", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  pending: ["Payment pending", "bg-amber-50 text-amber-700 ring-amber-200"],
  failed: ["Failed", "bg-red-50 text-red-700 ring-red-200"],
  cancelled: ["Expired", "bg-slate-100 text-slate-600 ring-slate-200"],
  refunded: ["Refunded", "bg-violet-50 text-violet-700 ring-violet-200"],
};

export function MyTrips() {
  const site = useSite();
  const [service, setService] = useState<ServiceKey | "">("");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tick, setTick] = useState(0);
  const [resuming, setResuming] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    api<{ bookings: Trip[] }>(`/api/account/bookings${service ? `?service=${service}` : ""}`)
      .then((r) => {
        if (!alive) return;
        setTrips(r.bookings);
        setNow(Date.now());
      })
      .catch(() => alive && setTrips([]));
    return () => {
      alive = false;
    };
  }, [tick, service]);

  const resume = async (t: Trip) => {
    setResuming(t.ref);
    try {
      const r = await api<{ checkout: Record<string, unknown> }>(`/api/bookings/${t.ref}/checkout`);
      await openCheckout(r.checkout, {
        onSuccess: async (resp) => {
          try {
            await api("/api/bookings/train/verify", { body: { bookingRef: t.ref, ...resp } });
            toast.success("Payment received — issuing your ticket");
          } catch (e) {
            toast.error(errMsg(e));
          }
          setTimeout(() => setTick((x) => x + 1), 1500);
        },
        onFailed: (f) => toast.error(f.error.description || "Payment failed"),
        onDismiss: () => setResuming(null),
      });
    } catch (e) {
      toast.error(errMsg(e));
      setTick((x) => x + 1);
    } finally {
      setResuming(null);
    }
  };

  const today = new Date(now).toISOString().slice(0, 10);
  const shown = (trips || []).filter((t) => {
    if (period === "upcoming") return t.date >= today;
    if (period === "90" || period === "180") return now - new Date(t.createdAt).getTime() <= Number(period) * 86400_000;
    return true;
  });
  const tabs = SERVICE_TABS.filter((x) => !x.key || isServiceOn(site, x.key));

  const filters = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {tabs.map((x) => (
          <button key={x.key || "all"} onClick={() => setService(x.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition", service === x.key ? "border-ink bg-ink text-white" : "border-line text-ink/70 hover:border-ink/30")}>
            {x.icon && <x.icon className="h-3.5 w-3.5" />} {x.label}
          </button>
        ))}
      </div>
      <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold">
        {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </div>
  );

  if (!trips) return <div className="space-y-4">{filters}<div className="h-40 animate-shimmer rounded-3xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" /></div>;
  if (shown.length === 0)
    return (
      <div className="space-y-4">
        {filters}
        <div className="rounded-3xl border border-line bg-white p-10 text-center shadow-soft">
          <div className="text-4xl">🧳</div>
          <p className="mt-2 font-bold">{trips.length ? "No trips match these filters" : "No trips yet"}</p>
          <p className="text-sm text-muted">Your bookings appear here with live status and e-tickets.</p>
          <Link href="/#search" className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Plan a trip</Link>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {filters}
      {shown.map((t, i) => {
        const holdLeft = t.holdExpiresAt ? new Date(t.holdExpiresAt).getTime() - now : 0;
        const expired = t.status === "pending" && t.paymentStatus !== "paid" && holdLeft <= 0;
        const [label, tone] = expired ? ["Expired", "bg-slate-100 text-slate-600 ring-slate-200"] : STATUS[t.status] || [t.status, "bg-surface text-ink ring-line"];
        return (
          <motion.article key={t.ref} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/60 px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                {t.flight ? <AirlineLogo iata={t.flight.legs[0].airline.iata} size={22} className="rounded-md" /> : <TrainFront className="h-4 w-4 text-brand" />}
                <span className="font-extrabold">{t.train.name}</span>
                <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{t.train.number}</span>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", tone)}>{label}</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              {t.flight ? (
                <div>
                  <div className="flex items-center gap-4">
                    <div><div className="text-2xl font-black tabular-nums">{t.flight.dep}</div><div className="text-xs font-bold text-muted">{t.flight.legs[0].from.iata} · {t.flight.legs[0].from.city}</div></div>
                    <div className="flex flex-1 flex-col items-center text-[11px] font-bold text-muted">
                      <span>{Math.floor(t.flight.durationMin / 60)}h {t.flight.durationMin % 60}m</span>
                      <span className="relative my-1 h-px w-full bg-[repeating-linear-gradient(90deg,#c7d2fe_0_5px,transparent_5px_9px)]"><Plane className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 fill-[#0057ff] text-[#0057ff]" /></span>
                      <span className={t.flight.stops ? "text-amber-600" : "text-emerald-600"}>{t.flight.stops ? `1 stop · ${t.flight.legs[0].to.iata}` : "Non-stop"}</span>
                    </div>
                    <div className="text-right"><div className="text-2xl font-black tabular-nums">{t.flight.arr}{t.flight.dayOffset ? <sup className="text-[10px] text-orange-500">+{t.flight.dayOffset}</sup> : null}</div><div className="text-xs font-bold text-muted">{t.flight.legs[t.flight.legs.length - 1].to.city} · {t.flight.legs[t.flight.legs.length - 1].to.iata}</div></div>
                  </div>
                  <div className="mt-1 text-sm text-muted">{prettyDate(t.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {t.cls} · Terminal {t.flight.legs[0].from.terminal || "–"}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(t.flight.allocations || t.flight.passengers).map((a, k) => (
                      <span key={k} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold">
                        {a.name} <span className="font-mono font-extrabold text-[#0057ff]">{Object.values(a.seats).map((x) => x || "Auto").join(" / ")}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
              <div>
                <div className="text-xl font-extrabold">{t.from} → {t.to}</div>
                <div className="mt-0.5 text-sm text-muted">{prettyDate(t.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {CLASS_NAMES[t.cls] || t.cls} · {t.food ? <span className="inline-flex items-center gap-1"><Utensils className="h-3 w-3" /> with food</span> : "no food"}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(t.ticket?.allocations || t.passengers.map((p) => ({ name: p.name, status: "—" } as { name: string; status: string; coach?: string; berth?: number }))).map((a, k) => (
                    <span key={k} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold">
                      {a.name} <span className={cn("font-extrabold", a.status === "CNF" ? "text-emerald-600" : a.status === "—" ? "text-muted" : "text-orange-600")}>{a.status}</span>
                      {a.coach ? <span className="text-muted"> {a.coach}/{a.berth}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
              )}
              <div className="flex flex-col items-start gap-2 md:items-end">
                {t.pnr && <div className="font-mono text-sm font-extrabold">PNR {t.pnr}</div>}
                <div className="text-lg font-extrabold">{fmtINR(t.amount)}</div>
                <div className="text-[11px] text-muted">Ref {t.ref}</div>
                {t.ticketStatus === "issued" && (
                  <div className="flex flex-wrap gap-1.5 md:justify-end">
                    <a href={`/api/bookings/${t.ref}/ticket`} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-3.5 py-2 text-xs font-extrabold text-white transition hover:-translate-y-0.5"><Download className="h-3.5 w-3.5" /> E-ticket</a>
                    {t.flight && t.date === todayIST() && site.flight_live === "on" && (
                      <Link href={`/flights/status?flight=${t.flight.legs[0].airline.iata}${t.flight.legs[0].number}`} className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3.5 py-2 text-xs font-extrabold text-sky-700 transition hover:-translate-y-0.5"><Radar className="h-3.5 w-3.5" /> Track live</Link>
                    )}
                    {t.ticket?.hasProviderPdf && (
                      <a href={`/api/bookings/${t.ref}/ticket?kind=irctc`} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-extrabold text-white transition hover:-translate-y-0.5"><Ticket className="h-3.5 w-3.5" /> IRCTC ticket</a>
                    )}
                    <a href={`/api/bookings/${t.ref}/invoice?view=1`} target="_blank" rel="noopener" title={t.gst ? `GST invoice for ${t.gst.company}` : "Payment invoice"} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-extrabold text-ink transition hover:-translate-y-0.5"><FileText className="h-3.5 w-3.5" /> Invoice</a>
                  </div>
                )}
                {t.status === "pending" && t.paymentStatus !== "paid" && holdLeft > 0 && (
                  <button onClick={() => resume(t)} disabled={resuming === t.ref} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-60">
                    {resuming === t.ref ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Resume payment · {Math.ceil(holdLeft / 60000)}m left
                  </button>
                )}
                {(expired || (t.status === "cancelled" && t.paymentStatus !== "paid")) && <span className="text-xs font-semibold text-muted">Not paid in time — search again to book</span>}
              </div>
            </div>
            {(t.refund || t.failure) && (
              <div className={cn("border-t px-5 py-3 text-xs font-semibold", t.refund && !t.refund.pending ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800")}>
                {t.failure && !t.refund && <>{t.failure} A full refund will be started automatically.</>}
                {t.refund && (t.refund.pending ? <>Refund of {fmtINR(t.refund.amount)} started — it reaches your source account in 5–7 working days.</> : <>Refund of {fmtINR(t.refund.amount)} processed to your source account.</>)}
              </div>
            )}
            {t.charges && (
              <div className="border-t border-line">
                <button onClick={() => setOpen(open === t.ref ? null : t.ref)} className="flex w-full items-center justify-between px-5 py-2.5 text-xs font-bold text-ink/70 hover:bg-surface/60">
                  <span className="flex items-center gap-2">Price details{t.insurance?.opted && <span className="flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[10px] text-mint"><ShieldPlus className="h-3 w-3" /> Insured</span>}</span>
                  <ChevronDown className={cn("h-4 w-4 transition", open === t.ref && "rotate-180")} />
                </button>
                {open === t.ref && (
                  <ul className="space-y-1 px-5 pb-4 text-sm">
                    {t.charges.lines.map((l) => (
                      <li key={l.key} className="flex justify-between"><span className="text-muted">{l.label}</span><span className="font-semibold tabular-nums">{fmtINR(l.paise / 100)}</span></li>
                    ))}
                    <li className="flex justify-between border-t border-line pt-1.5 font-extrabold"><span>Total{t.flight ? "" : ` (${t.charges.payMode === "upi" ? "UPI" : "Card / NetBanking"})`}</span><span>{fmtINR(t.charges.totalPaise / 100)}</span></li>
                  </ul>
                )}
              </div>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
