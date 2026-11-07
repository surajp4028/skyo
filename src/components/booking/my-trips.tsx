"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CreditCard, Download, Loader2, TrainFront, Utensils } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { CLASS_NAMES, fmtINR, prettyDate } from "@/lib/train/format";
import { cn } from "@/lib/utils";

type Trip = {
  ref: string; service: string; status: string; paymentStatus: string; ticketStatus: string; amount: number; createdAt: string; holdExpiresAt: string | null; pnr: string | null;
  train: { number: string; name: string }; from: string; to: string; date: string; cls: string; quota: string; food: boolean;
  passengers: { name: string; age: number; gender: string }[];
  ticket: { pnr: string; allocations: { name: string; status: string; coach?: string; berth?: number; berthType?: string }[] } | null;
};

const STATUS: Record<string, [string, string]> = {
  confirmed: ["Confirmed", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  pending: ["Payment pending", "bg-amber-50 text-amber-700 ring-amber-200"],
  failed: ["Failed", "bg-red-50 text-red-700 ring-red-200"],
  cancelled: ["Cancelled", "bg-slate-100 text-slate-600 ring-slate-200"],
  refunded: ["Refunded", "bg-violet-50 text-violet-700 ring-violet-200"],
};

export function MyTrips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tick, setTick] = useState(0);
  const [resuming, setResuming] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    api<{ bookings: Trip[] }>("/api/account/bookings")
      .then((r) => {
        if (!alive) return;
        setTrips(r.bookings);
        setNow(Date.now());
      })
      .catch(() => alive && setTrips([]));
    return () => {
      alive = false;
    };
  }, [tick]);

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

  if (!trips) return <div className="h-40 animate-shimmer rounded-3xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />;
  if (trips.length === 0)
    return (
      <div className="rounded-3xl border border-line bg-white p-10 text-center shadow-soft">
        <div className="text-4xl">🧳</div>
        <p className="mt-2 font-bold">No trips yet</p>
        <p className="text-sm text-muted">Your bookings appear here with live status and e-tickets.</p>
        <Link href="/#search" className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Plan a trip</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {trips.map((t, i) => {
        const [label, tone] = STATUS[t.status] || [t.status, "bg-surface text-ink ring-line"];
        const holdLeft = t.holdExpiresAt ? new Date(t.holdExpiresAt).getTime() - now : 0;
        return (
          <motion.article key={t.ref} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/60 px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <TrainFront className="h-4 w-4 text-brand" />
                <span className="font-extrabold">{t.train.name}</span>
                <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{t.train.number}</span>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", tone)}>{label}</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
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
              <div className="flex flex-col items-start gap-2 md:items-end">
                {t.pnr && <div className="font-mono text-sm font-extrabold">PNR {t.pnr}</div>}
                <div className="text-lg font-extrabold">{fmtINR(t.amount)}</div>
                <div className="text-[11px] text-muted">Ref {t.ref}</div>
                {t.ticketStatus === "issued" && (
                  <a href={`/api/bookings/${t.ref}/ticket`} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0057ff] to-[#2f94ff] px-3.5 py-2 text-xs font-extrabold text-white transition hover:-translate-y-0.5"><Download className="h-3.5 w-3.5" /> E-ticket PDF</a>
                )}
                {t.status === "pending" && t.paymentStatus !== "paid" && holdLeft > 0 && (
                  <button onClick={() => resume(t)} disabled={resuming === t.ref} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-60">
                    {resuming === t.ref ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Resume payment · {Math.ceil(holdLeft / 60000)}m left
                  </button>
                )}
                {t.status === "pending" && holdLeft <= 0 && <span className="text-xs font-semibold text-muted">Hold expired</span>}
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
