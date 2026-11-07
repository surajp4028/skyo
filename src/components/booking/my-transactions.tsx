"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmtMoney as fmtINR } from "@/lib/train/format";
import { cn } from "@/lib/utils";

type Attempt = {
  id: number; bookingRef: string; paymentId: string | null; orderId: string | null; status: string; method: string | null; amount: number | null;
  error: string | null; verified: boolean; at: string; updatedAt: string; service: string | null; title: string | null;
};

const TONE: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  captured: { label: "Successful", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  authorized: { label: "Processing", cls: "bg-sky-50 text-sky-700 ring-sky-200", icon: Clock },
  created: { label: "Started", cls: "bg-slate-100 text-slate-600 ring-slate-200", icon: Clock },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700 ring-red-200", icon: XCircle },
  refunded: { label: "Refunded", cls: "bg-violet-50 text-violet-700 ring-violet-200", icon: CheckCircle2 },
};
const METHOD: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

type Refund = { bookingRef: string; refundId: string | null; amount: number; status: string; at: string; updatedAt: string };

export function MyTransactions() {
  const [rows, setRows] = useState<Attempt[] | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  useEffect(() => {
    let alive = true;
    api<{ attempts: Attempt[]; refunds: Refund[] }>("/api/account/transactions").then((r) => alive && (setRows(r.attempts), setRefunds(r.refunds || []))).catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!rows) return <div className="h-32 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />;
  if (!rows.length) return <div className="rounded-2xl bg-surface p-8 text-center text-sm text-muted">No payments yet. When you pay for a booking, every attempt shows up here.</div>;

  const ok = rows.filter((r) => r.status === "captured").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Attempts" value={rows.length} />
        <Stat label="Successful" value={ok} tone="text-emerald-600" />
        <Stat label="Failed" value={failed} tone="text-red-600" />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {rows.map((r) => {
          const t = TONE[r.status] || { label: r.status, cls: "bg-surface text-ink ring-line", icon: Clock };
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <t.icon className={cn("h-5 w-5 shrink-0", r.status === "captured" ? "text-emerald-600" : r.status === "failed" ? "text-red-600" : "text-muted")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{r.title || r.bookingRef}</div>
                <div className="text-[11px] text-muted">
                  {new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {r.method ? METHOD[r.method] || r.method : "—"} · Booking {r.bookingRef}
                </div>
                {r.error && r.status === "failed" && <div className="mt-0.5 text-[11px] font-semibold text-red-600">{r.error}</div>}
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold">{r.amount != null ? fmtINR(r.amount) : "—"}</div>
                <span className={cn("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1", t.cls)}>{t.label}</span>
              </div>
              {r.paymentId && (
                <button onClick={() => navigator.clipboard?.writeText(r.paymentId!).then(() => toast.success("Payment ID copied"))} className="flex w-full items-center gap-1.5 font-mono text-[11px] text-muted hover:text-ink sm:w-auto" title="Share this with support">
                  {r.paymentId} <Copy className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {refunds.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-extrabold">Refunds</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {refunds.map((r) => (
              <li key={r.refundId ?? r.at} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <CheckCircle2 className={cn("h-5 w-5 shrink-0", r.status === "processed" ? "text-emerald-600" : "text-amber-500")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">Refund for {r.bookingRef}</div>
                  <div className="text-[11px] text-muted">{new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {r.refundId ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-emerald-700">+ {fmtINR(r.amount)}</div>
                  <span className={cn("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1", r.status === "processed" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>{r.status === "processed" ? "Credited" : "In progress (5–7 days)"}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-mint" /> Statuses are confirmed with Razorpay. If money was debited for a failed booking, it is refunded to the same account.</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className={cn("text-2xl font-extrabold", tone)}>{value}</div>
      <div className="text-[11px] font-semibold text-muted">{label}</div>
    </div>
  );
}
