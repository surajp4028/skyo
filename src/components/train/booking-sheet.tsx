"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, CheckCircle2, CreditCard, Download, Loader2, Lock, Plus, ShieldCheck, ShieldPlus, Smartphone, Trash2, TrainFront, Utensils, UtensilsCrossed, X } from "lucide-react";
import { CLASS_NAMES, fmtINR, fmtMoney, prettyDate, quotaLabel, statusTone } from "@/lib/train/format";
import { api, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { useSite } from "@/lib/client/providers";
import { PassengerForm, berthLabel, genderLabel, type SavedPassenger } from "@/components/booking/passenger-form";
import { cn } from "@/lib/utils";
import { insuranceOffered, trainCharges, type PayMode } from "@/lib/train/charges";

export type BookingIntent = {
  train: string; name?: string; from: string; to: string; date: string; cls: string; quota: string;
  status?: string; text?: string; fare?: number | null; baseFare?: number | null; catering?: number | null; totalFare?: number | null;
};
type Stage = "form" | "paying" | "verifying" | "done" | "failed";
type Booking = { ref: string; status: string; paymentStatus: string; ticketStatus: string; amount: number; pnr: string | null; details: { ticket?: { pnr: string; allocations: { name: string; status: string; coach?: string; berth?: number; berthType?: string }[] }; failure?: string } };

/**
 * Real booking flow: travellers → food → pay (Razorpay) → server verification → ticket.
 * Amounts shown here are estimates; the server re-prices from live availability and creates the order.
 */
export function BookingSheet({ b, onClose }: { b: BookingIntent; onClose: () => void }) {
  const site = useSite();
  const maxPax = Math.min(b.quota === "TQ" || b.quota === "PT" ? 4 : 6, Number(site.max_passengers_per_booking) || 6);
  const [list, setList] = useState<SavedPassenger[] | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const hasFood = (b.catering ?? 0) > 0;
  const [food, setFood] = useState(true);
  const [stage, setStage] = useState<Stage>("form");
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<PayMode>("upi");
  const offerInsurance = insuranceOffered(site);
  const [insurance, setInsurance] = useState(true);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ passengers: SavedPassenger[] }>("/api/account/passengers").then((r) => alive && setList(r.passengers)).catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stage !== "paying" && stage !== "verifying" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, stage]);

  const base = b.baseFare ?? b.fare ?? 0;
  const withFood = b.totalFare ?? base + (b.catering ?? 0);
  const perPax = hasFood && food ? withFood : base;
  const charges = trainCharges(site, { perPassengerFare: perPax, count: sel.length, cls: b.cls, payMode, insurance: offerInsurance && insurance });
  const estimate = charges.totalPaise / 100;
  const upiCharges = trainCharges(site, { perPassengerFare: perPax, count: Math.max(1, sel.length), cls: b.cls, payMode: "upi", insurance: offerInsurance && insurance }).totalPaise;
  const cardCharges = trainCharges(site, { perPassengerFare: perPax, count: Math.max(1, sel.length), cls: b.cls, payMode: "card", insurance: offerInsurance && insurance }).totalPaise;

  const removePassenger = async (id: number) => {
    try {
      await api(`/api/account/passengers/${id}`, { method: "DELETE" });
      setList((l) => (l || []).filter((x) => x.id !== id));
      setSel((s) => s.filter((x) => x !== id));
      toast.success("Traveller removed");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setConfirmDel(null);
    }
  };
  const tone = statusTone(b.status);

  const pollBooking = async (r: string) => {
    for (let i = 0; i < 8; i++) {
      const x = await api<{ booking: Booking }>(`/api/bookings/${r}`).catch(() => null);
      if (x && (x.booking.ticketStatus !== "not_issued" || x.booking.status === "failed")) return x.booking;
      await new Promise((res) => setTimeout(res, 1200));
    }
    return (await api<{ booking: Booking }>(`/api/bookings/${r}`)).booking;
  };

  const startPayment = async (checkout: Record<string, unknown>, bookingRef: string) => {
    setStage("paying");
    await openCheckout(checkout, {
      onSuccess: async (resp) => {
        setStage("verifying");
        try {
          await api("/api/bookings/train/verify", { body: { bookingRef, ...resp } });
          const bk = await pollBooking(bookingRef);
          setBooking(bk);
          setStage(bk.ticketStatus === "issued" ? "done" : "failed");
          if (bk.ticketStatus !== "issued") setFailMsg(bk.details.failure || "Payment received, but the ticket couldn't be issued. A refund will be initiated.");
        } catch (e) {
          setFailMsg(errMsg(e));
          setStage("failed");
        }
      },
      onFailed: (r) => {
        setFailMsg(r.error.description || "Payment failed.");
      },
      onDismiss: () => {
        setStage((s) => (s === "paying" ? "form" : s));
        toast.info("Payment not completed", { description: "Your booking is held for 15 minutes — you can resume it from My trips." });
      },
    }).catch((e) => {
      setStage("form");
      toast.error(errMsg(e));
    });
  };

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api<{ bookingRef: string; pricing: { total: number }; charges: { totalPaise: number }; checkout: Record<string, unknown> }>("/api/bookings/train/initiate", {
        body: { train: b.train, trainName: b.name || b.train, from: b.from, to: b.to, date: b.date, cls: b.cls, quota: b.quota, passengerIds: sel, food: hasFood && food, payMode, insurance: offerInsurance && insurance },
      });
      setRef(r.bookingRef);
      if (Math.abs(r.charges.totalPaise / 100 - estimate) >= 1) toast.info(`Total updated to ${fmtMoney(r.charges.totalPaise / 100)} from live availability`);
      await startPayment(r.checkout, r.bookingRef);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={() => stage === "form" && onClose()} />
      <motion.div initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl">
        <div className="relative shrink-0 bg-[linear-gradient(120deg,#0057ff,#1a82ff_60%,#38bdf8)] p-5 text-white">
          {stage === "form" && <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-xl p-2 text-white/80 hover:bg-white/15"><X className="h-5 w-5" /></button>}
          <div className="flex items-center gap-2 text-xs font-bold text-white/80"><TrainFront className="h-4 w-4" /> {b.train}{b.name ? ` · ${b.name}` : ""}</div>
          <div className="mt-1.5 text-2xl font-extrabold">{b.from} → {b.to}</div>
          <div className="mt-0.5 text-xs text-white/85">{prettyDate(b.date, { weekday: "long", day: "numeric", month: "long" })} · {CLASS_NAMES[b.cls] || b.cls} · {quotaLabel(b.quota)}</div>
          {b.text && <span className={cn("mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-extrabold", tone.text)}>{b.text}</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-extrabold">Travellers <span className="text-xs font-semibold text-muted">({sel.length}/{maxPax})</span></h3>
                    {!adding && <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-bold text-brand"><Plus className="h-3.5 w-3.5" /> Add new</button>}
                  </div>
                  {adding && (
                    <div className="mb-3 rounded-2xl border border-line p-4">
                      <PassengerForm compact onCancel={() => setAdding(false)} onSaved={(p) => {
                        setList((l) => [...(l || []), p]);
                        setSel((s) => (s.length < maxPax ? [...s, p.id] : s));
                        setAdding(false);
                      }} />
                    </div>
                  )}
                  {!list ? (
                    <div className="h-16 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />
                  ) : list.length === 0 && !adding ? (
                    <button onClick={() => setAdding(true)} className="w-full rounded-2xl border-2 border-dashed border-line p-5 text-sm font-bold text-muted hover:border-brand hover:text-brand">+ Add your first traveller</button>
                  ) : (
                    <div className="space-y-2">
                      {list.map((p) => {
                        const on = sel.includes(p.id);
                        const blocked = !on && sel.length >= maxPax;
                        const young = p.age < 5;
                        return (
                          <div key={p.id} className={cn("flex items-center gap-2 rounded-2xl border-2 pr-2 transition", on ? "border-[#0057ff] bg-sky-50" : "border-line hover:border-ink/25", (blocked || young) && "opacity-40")}>
                            <button disabled={blocked || young} onClick={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", on ? "border-[#0057ff] bg-[#0057ff] text-white" : "border-ink/25")}>{on && <BadgeCheck className="h-3.5 w-3.5" />}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">{p.name}</span>
                                <span className="block text-[11px] text-muted">{p.age} yrs · {genderLabel(p.gender)} · {berthLabel(p.berth)}{young ? " · under 5 travels free" : ""}</span>
                              </span>
                            </button>
                            {confirmDel === p.id ? (
                              <span className="flex shrink-0 items-center gap-1">
                                <button onClick={() => removePassenger(p.id)} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white">Delete</button>
                                <button onClick={() => setConfirmDel(null)} className="rounded-lg px-2 py-1 text-[11px] font-bold text-muted hover:bg-surface">Keep</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDel(p.id)} aria-label={`Delete ${p.name}`} title="Delete traveller" className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {hasFood && (
                  <section>
                    <h3 className="mb-2 font-extrabold">Meals</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { v: true, t: "With food", p: withFood, icon: Utensils },
                        { v: false, t: "Without food", p: base, icon: UtensilsCrossed },
                      ].map((o) => (
                        <button key={o.t} onClick={() => setFood(o.v)} className={cn("rounded-2xl border-2 p-3 text-left transition", food === o.v ? "border-[#0057ff] bg-sky-50" : "border-line hover:border-ink/25")}>
                          <o.icon className={cn("h-4 w-4", food === o.v ? "text-[#0057ff]" : "text-muted")} />
                          <div className="mt-1 text-sm font-bold">{o.t}</div>
                          <div className="text-xs text-muted">{fmtINR(o.p)} / person</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">Catering charge {fmtINR(b.catering)} per person is set by IRCTC.</p>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 font-extrabold">How will you pay?</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "upi" as const, t: "UPI", d: "GPay, PhonePe, Paytm…", icon: Smartphone, total: upiCharges },
                      { v: "card" as const, t: "Card / NetBanking", d: "Debit, credit, net banking", icon: CreditCard, total: cardCharges },
                    ]).map((o) => (
                      <button key={o.v} onClick={() => setPayMode(o.v)} className={cn("rounded-2xl border-2 p-3 text-left transition", payMode === o.v ? "border-[#0057ff] bg-sky-50" : "border-line hover:border-ink/25")}>
                        <o.icon className={cn("h-4 w-4", payMode === o.v ? "text-[#0057ff]" : "text-muted")} />
                        <div className="mt-1 text-sm font-bold">{o.t}</div>
                        <div className="text-[11px] text-muted">{o.d}</div>
                        {sel.length > 0 && <div className="mt-1 text-xs font-bold">{fmtMoney(o.total / 100)}</div>}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">IRCTC&apos;s convenience fee is lower for UPI. Only the method you pick is shown in the payment window.</p>
                </section>

                {offerInsurance && (
                  <section>
                    <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition", insurance ? "border-mint bg-mint/5" : "border-line")}>
                      <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} className="mt-1 h-4 w-4 accent-[#0057ff]" />
                      <span className="flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-bold"><ShieldPlus className="h-4 w-4 text-mint" /> Travel insurance</span>
                        <span className="block text-[11px] text-muted">{fmtINR(Number(site.train_insurance_fee))} per traveller · covers accidents during the journey. Policy details are shared after booking.</span>
                      </span>
                    </label>
                  </section>
                )}

                <section className="rounded-2xl bg-surface p-4">
                  <h3 className="mb-2 text-sm font-extrabold">Price details</h3>
                  {sel.length === 0 ? (
                    <p className="text-xs text-muted">Select travellers to see the full price.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {charges.lines.map((l) => (
                        <li key={l.key} className="flex justify-between gap-3">
                          <span className="text-muted">{l.label}{l.note && l.key === "fare" ? <span className="block text-[10px]">{l.note}</span> : null}</span>
                          <span className="font-semibold tabular-nums">{fmtMoney(l.paise / 100)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex items-end justify-between border-t border-line pt-2"><span className="font-bold">Total</span><span className="text-2xl font-extrabold">{fmtMoney(estimate)}</span></div>
                  <p className="mt-1 text-[11px] text-muted">The final amount is calculated by our server from live availability before payment — it can&apos;t be changed in the browser.</p>
                </section>
              </motion.div>
            )}

            {(stage === "paying" || stage === "verifying") && (
              <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-[#0057ff]" />
                <h3 className="mt-4 text-lg font-extrabold">{stage === "paying" ? "Complete payment in the Razorpay window" : "Confirming your payment & issuing ticket…"}</h3>
                <p className="mt-1 text-sm text-muted">{stage === "paying" ? "Don't close this page." : "This takes a few seconds. Please don't refresh."}</p>
                {failMsg && stage === "paying" && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{failMsg} — you can retry in the payment window.</p>}
              </motion.div>
            )}

            {stage === "done" && booking && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 text-mint"><CheckCircle2 className="h-9 w-9" /></motion.span>
                <h3 className="mt-4 text-2xl font-extrabold">Booking confirmed</h3>
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-2 font-mono text-lg font-extrabold tracking-wider text-white">PNR {booking.pnr}</div>
                <div className="mt-4 space-y-1.5 text-left">
                  {booking.details.ticket?.allocations.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm">
                      <span className="font-bold">{a.name}</span>
                      <span className={cn("font-extrabold", a.status === "CNF" ? "text-mint" : "text-orange-600")}>{a.status}{a.coach ? ` · ${a.coach}/${a.berth} ${a.berthType ?? ""}` : ""}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">Booking {booking.ref} · Paid {fmtMoney(booking.amount)}</p>
              </motion.div>
            )}

            {stage === "failed" && (
              <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-7 w-7" /></span>
                <h3 className="mt-4 text-lg font-extrabold">We couldn&apos;t complete this booking</h3>
                <p className="mt-1 text-sm text-muted">{failMsg}</p>
                {ref && <p className="mt-2 text-xs text-muted">Reference {ref} — our team can see every step of this payment.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 border-t border-line p-4">
          {stage === "form" && (
            <button onClick={pay} disabled={busy || sel.length === 0} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] py-3.5 text-base font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(0,87,255,0.85)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
              <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
              {sel.length ? `Pay ${fmtMoney(estimate)} securely` : "Select travellers to continue"}
            </button>
          )}
          {stage === "done" && booking && (
            <div className="grid grid-cols-2 gap-2">
              <a href={`/api/bookings/${booking.ref}/ticket`} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] py-3 text-sm font-extrabold text-white"><Download className="h-4 w-4" /> E-ticket (PDF)</a>
              <Link href="/account?tab=trips" className="flex items-center justify-center rounded-2xl border border-line py-3 text-sm font-bold">My trips</Link>
            </div>
          )}
          {stage === "failed" && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => (setStage("form"), setFailMsg(null))} className="rounded-2xl border border-line py-3 text-sm font-bold">Try again</button>
              <Link href="/contact" className="flex items-center justify-center rounded-2xl bg-ink py-3 text-sm font-bold text-white">Contact support</Link>
            </div>
          )}
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-mint" /> Payments by Razorpay · 256-bit SSL · We never see your card</p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Blue primary "Book" button with lift + sheen on hover. */
export function BookButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_12px_28px_-12px_rgba(0,87,255,0.85)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-12px_rgba(0,87,255,0.95)] active:translate-y-0 active:scale-[0.98]",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
      <span className="relative flex items-center gap-1.5">{label} <span className="transition group-hover:translate-x-0.5">→</span></span>
    </button>
  );
}
