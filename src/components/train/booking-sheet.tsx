"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpCircle, BadgePercent, BadgeCheck, ChevronDown, FileText, MapPin, CheckCircle2, CreditCard, Download, Loader2, Lock, Plus, ShieldCheck, ShieldPlus, Smartphone, Trash2, TrainFront, Utensils, UtensilsCrossed, X } from "lucide-react";
import { CLASS_NAMES, fmtINR, fmtMoney, prettyDate, quotaLabel, statusTone } from "@/lib/train/format";
import { api, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { useAuth, useSite } from "@/lib/client/providers";
import { PassengerForm, berthLabel, genderLabel, type SavedPassenger } from "@/components/booking/passenger-form";
import { cn } from "@/lib/utils";
import { BillingFields, billingValid, GstPanel, useGstProfile, type Billing } from "@/components/booking/gst-panel";
import { couponLabel, insuranceOffered, trainCharges, type CouponRule, type PayMode } from "@/lib/train/charges";

type Offer = { code: string; title: string | null; type: CouponRule["type"]; value: number; applyOn: CouponRule["applyOn"]; maxDiscount: number | null; minOrder: number | null; usesLeftForYou: number | null; personal?: boolean };
const toRule = (o: Offer): CouponRule => ({ code: o.code, type: o.type, value: o.value, applyOn: o.applyOn, maxDiscount: o.maxDiscount, minOrder: o.minOrder });

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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupon, setCoupon] = useState<Offer | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [gp, setGp] = useGstProfile();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [useGst, setUseGst] = useState(true);
  const [autoUpgrade, setAutoUpgrade] = useState(true);
  const { user } = useAuth();
  const [ticketEmail, setTicketEmail] = useState("");
  const emailOk = !ticketEmail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ticketEmail);
  const [open, setOpen] = useState<"state" | "gst" | null>(null);
  const bill: Billing = billing ?? gp?.billing ?? { state: "", pincode: null, address: null };
  const stateOk = billingValid(bill);

  useEffect(() => {
    let alive = true;
    api<{ passengers: SavedPassenger[] }>("/api/account/passengers").then((r) => alive && setList(r.passengers)).catch(() => alive && setList([]));
    api<{ coupons: Offer[] }>("/api/coupons?service=train").then((r) => alive && setOffers(r.coupons)).catch(() => {});
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
  const couponRule = coupon ? toRule(coupon) : null;
  const charges = trainCharges(site, { perPassengerFare: perPax, count: sel.length, cls: b.cls, payMode, insurance: offerInsurance && insurance, coupon: couponRule });
  const estimate = charges.totalPaise / 100;
  const upiCharges = trainCharges(site, { perPassengerFare: perPax, count: Math.max(1, sel.length), cls: b.cls, payMode: "upi", insurance: offerInsurance && insurance, coupon: couponRule }).totalPaise;
  const cardCharges = trainCharges(site, { perPassengerFare: perPax, count: Math.max(1, sel.length), cls: b.cls, payMode: "card", insurance: offerInsurance && insurance, coupon: couponRule }).totalPaise;

  const applyCode = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const known = offers.find((o) => o.code === code);
    if (known) {
      setCoupon(known);
      setCodeInput("");
      return;
    }
    setChecking(true);
    try {
      const r = await api<{ coupon: Offer }>("/api/coupons/check", { body: { code, service: "train" } });
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
        body: { train: b.train, trainName: b.name || b.train, from: b.from, to: b.to, date: b.date, cls: b.cls, quota: b.quota, passengerIds: sel, food: hasFood && food, payMode, insurance: offerInsurance && insurance, couponCode: charges.coupon?.code ?? null,
                billing: { state: bill.state, pincode: bill.pincode || null, address: bill.address || null }, useGst: !!gp?.gst && useGst, autoUpgrade, notifyEmail: user?.email ? null : ticketEmail || null },
      });
      setRef(r.bookingRef);
      if (Math.abs(r.charges.totalPaise / 100 - estimate) >= 1) toast.info(`Total updated to ${fmtMoney(r.charges.totalPaise / 100)} from live availability`);
      await startPayment(r.checkout, r.bookingRef);
    } catch (e) {
      const msg = errMsg(e);
      if (/coupon/i.test(msg)) setCoupon(null);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={() => stage !== "paying" && stage !== "verifying" && onClose()} />
      <motion.div initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl">
        <div className="relative shrink-0 bg-[linear-gradient(120deg,#0057ff,#1a82ff_60%,#38bdf8)] p-5 text-white">
          {stage !== "paying" && stage !== "verifying" && (
            <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:rotate-90 hover:bg-white/30"><X className="h-5 w-5" /></button>
          )}
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

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3">
                  <input type="checkbox" checked={autoUpgrade} onChange={(e) => setAutoUpgrade(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0057ff]" />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-bold"><ArrowUpCircle className="h-4 w-4 text-[#0057ff]" /> Consider for auto upgradation</span>
                    <span className="block text-[11px] text-muted">If a higher class has free berths, IRCTC may upgrade you at no extra cost.</span>
                  </span>
                </label>

                {!user?.email && (
                  <div className="rounded-2xl border border-line p-3">
                    <label className="mb-1 block text-sm font-bold">Email for your e-ticket <span className="font-semibold text-muted">(optional)</span></label>
                    <input type="email" value={ticketEmail} onChange={(e) => setTicketEmail(e.target.value.trim())} placeholder="you@example.com" className={cn("h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none focus:border-[#0057ff]", emailOk ? "border-line" : "border-red-300")} />
                    <p className="mt-1 text-[11px] text-muted">Your account has no email yet — we&apos;ll send the ticket and invoice here. Add one permanently under My account → Contact.</p>
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-line">
                  <button onClick={() => setOpen(open === "state" ? null : "state")} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <MapPin className={cn("h-4 w-4", stateOk ? "text-[#0057ff]" : "text-amber-500")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Billing state</span>
                      <span className={cn("block truncate text-[11px]", stateOk ? "text-muted" : "font-semibold text-amber-600")}>{stateOk ? [bill.state, bill.pincode].filter(Boolean).join(" · ") : "Required — tap to select your state"}</span>
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted transition", open === "state" && "rotate-180")} />
                  </button>
                  {open === "state" && <div className="border-t border-line p-3"><BillingFields value={bill} onChange={setBilling} /><p className="mt-2 text-[11px] text-muted">Saved to your profile for next time.</p></div>}
                </div>

                <div className="overflow-hidden rounded-2xl border border-line">
                  <button onClick={() => setOpen(open === "gst" ? null : "gst")} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <FileText className="h-4 w-4 text-[#0057ff]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Add GST for tax benefits <span className="font-semibold text-muted">(optional)</span></span>
                      <span className="block truncate text-[11px] text-muted">{gp?.gst ? `${gp.gst.company} · ${gp.gst.gstin}` : "Claim input tax credit on your invoice"}</span>
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted transition", open === "gst" && "rotate-180")} />
                  </button>
                  {open === "gst" && gp && (
                    <div className="space-y-3 border-t border-line p-3">
                      <GstPanel compact gst={gp.gst} mode={gp.mode} onChange={(g) => (setGp({ ...gp, gst: g }), setUseGst(true))} />
                      {gp.gst && (
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input type="checkbox" checked={useGst} onChange={(e) => setUseGst(e.target.checked)} className="h-4 w-4 accent-[#0057ff]" /> Use these GST details for this booking
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 font-extrabold"><BadgePercent className="h-4 w-4 text-brand" /> Offers & coupons</h3>
                  {coupon ? (
                    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed p-3", charges.coupon ? "border-mint bg-mint/5" : "border-amber-300 bg-amber-50")}>
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-extrabold">{coupon.code}</div>
                        <div className="text-[11px] text-muted">{charges.coupon ? `${couponLabel(coupon)} · you save ${fmtMoney(charges.coupon.discountPaise / 100)}` : sel.length ? charges.couponError : "Select travellers to apply"}</div>
                      </div>
                      <button onClick={() => setCoupon(null)} className="shrink-0 text-xs font-bold text-red-600">Remove</button>
                    </div>
                  ) : (
                    <>
                      <form onSubmit={(e) => (e.preventDefault(), applyCode(codeInput))} className="flex gap-2">
                        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={32} placeholder="Enter coupon code" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#0057ff]" />
                        <button type="submit" disabled={!codeInput || checking} className="rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}</button>
                      </form>
                      {offers.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {offers.slice(0, 4).map((o) => (
                            <button key={o.code} onClick={() => setCoupon(o)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left transition hover:border-[#0057ff]">
                              <span className="min-w-0">
                                <span className="font-mono text-xs font-extrabold">{o.code}</span>
                                {o.personal && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">FOR YOU</span>}
                                <span className="block truncate text-[11px] text-muted">{o.title || couponLabel(o)}{o.usesLeftForYou != null ? ` · ${o.usesLeftForYou} use${o.usesLeftForYou === 1 ? "" : "s"} left` : ""}</span>
                              </span>
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
                  {sel.length === 0 ? (
                    <p className="text-xs text-muted">Select travellers to see the full price.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {charges.lines.map((l) => (
                        <li key={l.key} className="flex justify-between gap-3">
                          <span className="text-muted">{l.label}{l.note && l.key === "fare" ? <span className="block text-[10px]">{l.note}</span> : null}</span>
                          <span className={cn("font-semibold tabular-nums", l.paise < 0 && "text-mint")}>{l.paise < 0 ? `− ${fmtMoney(-l.paise / 100)}` : fmtMoney(l.paise / 100)}</span>
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
                <div className="relative mx-auto h-20 w-20">
                  <motion.span initial={{ scale: 0.6, opacity: 0.6 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 1.4, repeat: 2 }} className="absolute inset-0 rounded-full bg-mint/30" />
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-mint text-white shadow-[0_16px_40px_-12px_rgba(16,185,129,0.8)]"><CheckCircle2 className="h-10 w-10" /></motion.span>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold">Booking confirmed!</h3>
                <p className="mt-1 text-sm text-muted">Your e-ticket is ready — we&apos;ve also sent it by SMS / email.</p>
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
                <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-[0_16px_40px_-12px_rgba(239,68,68,0.7)]"><AlertTriangle className="h-8 w-8" /></motion.span>
                <h3 className="mt-5 text-xl font-extrabold">We couldn&apos;t complete this booking</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{failMsg}</p>
                <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-surface px-4 py-3 text-xs text-muted">If money was debited, it is refunded automatically to the same account in 5–7 working days. You can track it in My account → Transactions.</p>
                {ref && <p className="mt-2 text-xs text-muted">Reference {ref} — our team can see every step of this payment.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 border-t border-line p-4">
          {stage === "form" && (
            <button onClick={() => (stateOk ? pay() : setOpen("state"))} disabled={busy || sel.length === 0 || !emailOk} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] py-3.5 text-base font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(0,87,255,0.85)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
              <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
              {!sel.length ? "Select travellers to continue" : !stateOk ? "Select your billing state" : `Pay ${fmtMoney(estimate)} securely`}
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
