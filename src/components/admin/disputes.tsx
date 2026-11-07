"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, IndianRupee, Loader2, Plane, RefreshCw, Scale, TrainFront } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { useFetch } from "./use-fetch";
import { Card, PageHeader, StatCard, Table, Td } from "./ui";
import { BookingDrawer } from "./booking-drawer";
import { cn, fmtDate, formatINR, timeAgo } from "@/lib/utils";

type Item = {
  ref: string; service: string; userUid: string; userId: number | null; name: string | null; train: string; route: string; date: string; amountPaise: number; paidAt: string | null;
  paymentId: string | null; ticketStatus: string; status: string; reason: string; refundState: "none" | "pending" | "partial" | "refunded"; refundedPaise: number; pendingPaise: number; lastRefundAt: string | null;
};

const FILTERS = [
  ["action", "Needs action"], ["pending", "Refund pending"], ["refunded", "Refunded"], ["all", "All"],
] as const;

const STATE: Record<Item["refundState"], { label: string; cls: string }> = {
  none: { label: "Not refunded", cls: "border-red-200 bg-red-50 text-red-700" },
  pending: { label: "Refund pending", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  partial: { label: "Partly refunded", cls: "border-violet-200 bg-violet-50 text-violet-700" },
  refunded: { label: "Refunded", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

/**
 * Money that came in without a usable ticket (failed ticketing, paid after the hold expired, amount mismatch)
 * and every refund — so nothing paid is ever left unresolved.
 */
export function DisputesView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("action");
  const [open, setOpen] = useState<{ ref: string; service: string } | null>(null);
  const { data, loading, reload } = useFetch<{ items: Item[]; summary: { needsAction: number; needsActionPaise: number; pendingPaise: number; refundedPaise: number } }>(`/api/admin/disputes?filter=${filter}`);
  const [sync, setSync] = useState<{ busy: boolean; at: string | null; checked: number; failed: number }>({ busy: false, at: null, checked: 0, failed: 0 });
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  /** One click → every open case is re-checked with Razorpay in parallel batches. */
  const refreshAll = useCallback(async (silent = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSync((s) => ({ ...s, busy: true }));
    try {
      const r = await api<{ checked: number; failed: number; at: string }>("/api/admin/disputes/refresh", { method: "POST" });
      setSync({ busy: false, at: r.at, checked: r.checked, failed: r.failed });
      reload();
      if (!silent) toast.success(`Re-checked ${r.checked} booking${r.checked === 1 ? "" : "s"} with Razorpay${r.failed ? ` · ${r.failed} failed` : ""}`);
    } catch (e) {
      setSync((s) => ({ ...s, busy: false }));
      if (!silent) toast.error(errMsg(e));
    } finally {
      busyRef.current = false;
    }
  }, [reload]);

  // first sync on open, then every 60 s while this tab is visible and auto-refresh is on
  useEffect(() => {
    const first = setTimeout(() => void refreshAll(true), 300);
    const t = setInterval(() => {
      setNow(Date.now());
      if (auto && document.visibilityState === "visible") void refreshAll(true);
    }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => (clearTimeout(first), clearInterval(t), clearInterval(tick));
  }, [auto, refreshAll]);

  const ago = sync.at ? Math.max(0, Math.round((now - new Date(sync.at).getTime()) / 1000)) : null;
  return (
    <>
      <PageHeader
        icon={<Scale />}
        title="Disputes & refunds"
        sub="Payments received without a valid ticket, and every refund (by SKYO, an agent or the Razorpay Dashboard). Click a row to refund, retry or re-check."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-muted ring-1 ring-line">
              <span className={cn("h-1.5 w-1.5 rounded-full", sync.busy ? "animate-pulse bg-amber-500" : sync.at ? "bg-emerald-500" : "bg-neutral-300")} />
              {sync.busy ? "Checking with Razorpay…" : ago === null ? "Not synced yet" : `Last synced ${ago < 10 ? "just now" : ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`} · ${sync.checked} checked${sync.failed ? ` · ${sync.failed} failed` : ""}`}
            </span>
            <label className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink/70 ring-1 ring-line">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#0057ff]" /> Auto every 60s
            </label>
            <button onClick={() => refreshAll(false)} disabled={sync.busy} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
              {sync.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh all
            </button>
          </div>
        }
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Needs action" value={data?.summary.needsAction ?? "—"} hint={data ? formatINR(data.summary.needsActionPaise) + " held" : undefined} icon={<AlertTriangle />} tone="iris" />
        <StatCard label="Refund pending" value={data ? formatINR(data.summary.pendingPaise) : "—"} icon={<Clock />} tone="sky" />
        <StatCard label="Refunded" value={data ? formatINR(data.summary.refundedPaise) : "—"} icon={<CheckCircle2 />} tone="mint" />
        <StatCard label="Rule" value="Auto refund" hint="Ticket fails or payment arrives >10 min after hold" icon={<IndianRupee />} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition", filter === k ? "bg-ink text-white" : "text-ink/60 hover:bg-surface")}>
              {l}{k === "action" && data?.summary.needsAction ? <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{data.summary.needsAction}</span> : null}
            </button>
          ))}
        </div>
        <Table head={["Booking", "Customer", "Trip", "Paid", "Reason", "Refund", "When", ""]} loading={loading} empty={!data?.items.length}>
          {data?.items.map((i) => (
            <tr key={i.ref} onClick={() => setOpen({ ref: i.ref, service: i.service })} className="cursor-pointer hover:bg-neutral-50/70">
              <td className="px-4 py-3"><div className="font-mono text-xs font-bold">{i.ref}</div><div className="font-mono text-[10px] text-muted">{i.paymentId}</div></td>
              <Td>{i.userId ? <Link href={`/admin/users/${i.userId}`} onClick={(e) => e.stopPropagation()} className="hover:underline"><div className="font-mono text-xs">{i.userUid}</div><div className="text-[11px] text-neutral-500">{i.name}</div></Link> : <span className="font-mono text-xs">{i.userUid}</span>}</Td>
              <td className="px-4 py-3 text-xs"><div className="flex items-center gap-1.5 font-semibold">{i.service === "flight" ? <Plane className="h-3.5 w-3.5 shrink-0 text-[#0057ff]" /> : <TrainFront className="h-3.5 w-3.5 shrink-0 text-brand" />}{i.train}</div><div className="text-muted">{i.route} · {fmtDate(i.date)}</div></td>
              <td className="px-4 py-3 text-xs font-bold">{formatINR(i.amountPaise)}</td>
              <td className="max-w-[220px] px-4 py-3 text-xs text-red-700">{i.reason}</td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", STATE[i.refundState].cls)}>{STATE[i.refundState].label}</span>
                {(i.refundedPaise > 0 || i.pendingPaise > 0) && <div className="mt-0.5 text-[10px] text-muted">{i.refundedPaise ? `${formatINR(i.refundedPaise)} credited` : ""}{i.pendingPaise ? ` ${formatINR(i.pendingPaise)} pending` : ""}</div>}
              </td>
              <td className="px-4 py-3 text-xs text-muted">{timeAgo(i.lastRefundAt || i.paidAt || "")}</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-brand">Open →</td>
            </tr>
          ))}
        </Table>
      </Card>
      <BookingDrawer service={open?.service ?? "train"} bookingRef={open?.ref ?? null} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
