"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BusFront, Building2, CheckCircle2, Clock, Eye, EyeOff, IndianRupee, Palmtree, Plane, TrainFront, XCircle } from "lucide-react";
import { BookingDrawer } from "./booking-drawer";
import { PayBadge } from "./pay-badge";
import type { PayInfo } from "@/lib/payment-method";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, StatCard, Table, Td, Toolbar, usePage } from "./ui";
import { useDebounced } from "./users";
import { FlightUsage } from "./flight-usage";
import { PnrUsage } from "./pnr-usage";
import { RailUsage } from "./rail-usage";
import { fmtDate, formatINR, timeAgo } from "@/lib/utils";
import type { ServiceKey } from "@/lib/permissions";

const META: Record<ServiceKey, { title: string; icon: typeof Plane; sub: string; trip: string }> = {
  train: { title: "Train bookings", icon: TrainFront, sub: "IRCTC tickets, PNRs and refunds.", trip: "Train / Route" },
  flight: { title: "Flight bookings", icon: Plane, sub: "Domestic & international flight tickets.", trip: "Flight / Sector" },
  bus: { title: "Bus bookings", icon: BusFront, sub: "Seats booked across bus operators.", trip: "Operator / Route" },
  hotel: { title: "Hotel bookings", icon: Building2, sub: "Room nights and stays.", trip: "Hotel / City" },
  package: { title: "Package bookings", icon: Palmtree, sub: "Holiday packages and itineraries.", trip: "Package" },
};

type B = { id: number; booking_ref: string; status: string; payment_status: string; title: string; origin: string | null; destination: string | null; travel_date: string | null; travellers: number; amount_paise: number; provider: string | null; created_at: string; user_id: number; user_name: string | null; user_uid: string; provider_ref: string | null; ticket_status?: string; pay_payment_id?: string | null; refund?: { processed: number; pending: number }; pay?: PayInfo | null; hold_expires_at?: string | null };

/** Payment column: what Razorpay has actually done, not just what we asked for. */
function payState(b: B) {
  const r = b.refund ?? { processed: 0, pending: 0 };
  if (r.processed >= b.amount_paise && b.amount_paise > 0) return { label: "refunded", cls: "border-violet-200 bg-violet-50 text-violet-700" };
  if (r.pending > 0) return { label: `refund pending · ${formatINR(r.pending)}`, cls: "border-amber-200 bg-amber-50 text-amber-700" };
  if (r.processed > 0) return { label: `partly refunded · ${formatINR(r.processed)}`, cls: "border-violet-200 bg-violet-50 text-violet-700" };
  return null;
}

export function BookingsView({ service }: { service: ServiceKey }) {
  const m = META[service];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${service}|${dq}|${status}|${range}`);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  // Stats visibility is remembered per browser (admins asked to hide numbers on shared screens).
  const [showStats, setShowStats] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read a per-browser preference once
      if (localStorage.getItem("skyo.admin.stats") === "hidden") setShowStats(false);
    } catch {}
  }, []);
  const flipStats = () =>
    setShowStats((v) => {
      try {
        localStorage.setItem("skyo.admin.stats", v ? "hidden" : "shown");
      } catch {}
      return !v;
    });
  const { data, loading, reload } = useFetch<{ bookings: B[]; total: number; page: number; size: number; summary: { confirmed: number; pending: number; cancelled: number; revenuePaise: number }; counts?: Record<string, number> }>(
    `/api/admin/bookings/${service}?${new URLSearchParams({ q: dq, status, range, page: String(page) })}`,
  );
  return (
    <>
      <PageHeader
        icon={<m.icon />}
        title={m.title}
        sub={m.sub}
        actions={
          <button onClick={flipStats} title={showStats ? "Hide stats" : "Show stats"} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink/70 transition hover:text-ink">
            {showStats ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showStats ? "Hide stats" : "Show stats"}
          </button>
        }
      />
      {showStats && (
        <>
          {service === "train" && <div className="mb-4 grid gap-4 xl:grid-cols-2"><RailUsage compact /><PnrUsage compact /></div>}
          {service === "flight" && <div className="mb-4"><FlightUsage compact /></div>}
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Confirmed" value={data?.summary.confirmed ?? "—"} icon={<CheckCircle2 />} tone="mint" />
            <StatCard label="Pending" value={data?.summary.pending ?? "—"} icon={<Clock />} tone="sky" />
            <StatCard label="Cancelled / refunded" value={data?.summary.cancelled ?? "—"} icon={<XCircle />} tone="iris" />
            <StatCard label="Revenue" value={data ? formatINR(data.summary.revenuePaise) : "—"} icon={<IndianRupee />} />
          </div>
        </>
      )}
      <Card>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-4 pt-3 pb-3">
          {([
            ["", "All", "all", ""], ["confirmed", "Confirmed", "confirmed", "bg-emerald-500"], ["pending", "Payment pending", "pending", "bg-sky-500"],
            ["action", "Needs action", "action", "bg-red-500"], ["refund_pending", "Refund pending", "refund_pending", "bg-amber-500"],
            ["refunded", "Refunded", "refunded", "bg-violet-500"], ["failed", "Failed", "failed", "bg-rose-500"], ["cancelled", "Cancelled / expired", "cancelled", "bg-neutral-400"],
          ] as const).map(([v, l, k, dot]) => (
            <button key={v || "all"} onClick={() => setStatus(v)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${status === v ? "bg-ink text-white" : "text-ink/60 hover:bg-surface"}`}>
              {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}{l}
              {data?.counts && <span className={`rounded-full px-1.5 text-[10px] ${status === v ? "bg-white/20" : k === "action" && data.counts[k] ? "bg-red-500 text-white" : "bg-surface"}`}>{data.counts[k] ?? 0}</span>}
            </button>
          ))}
        </div>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Booking ref, PNR / provider ref, or SKYO ID" />
          <Select value={range} onChange={setRange} options={[["", "Any time"], ["today", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]]} />
          <span className="ml-auto text-[11px] text-muted">Click a booking for full details</span>
        </Toolbar>
        <Table head={["Ref", m.trip, "SKYO ID", "Travel date", "Pax", "Amount", "Paid with", "Payment", "Status", "Booked", ""]} loading={loading} empty={!data?.bookings.length}>
          {data?.bookings.map((b) => (
            <tr key={b.id} onClick={() => setOpenRef(b.booking_ref)} className="cursor-pointer hover:bg-neutral-50/70">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-bold">{b.booking_ref}</td>
              <td className="px-4 py-2.5 text-xs">
                <div className="max-w-[210px] truncate whitespace-nowrap font-semibold" title={b.title}>{b.title}</div>
                <div className="whitespace-nowrap text-muted">{[b.origin, b.destination].filter(Boolean).join(" → ")}</div>
              </td>
              <Td><Link href={`/admin/users/${b.user_id}`} onClick={(e) => e.stopPropagation()} className="hover:underline"><div className="font-mono text-xs">{b.user_uid}</div><div className="text-[11px] text-neutral-500">{b.user_name}</div></Link></Td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs">{fmtDate(b.travel_date)}</td>
              <td className="px-4 py-3 text-center text-xs">{b.travellers}</td>
              <td className="px-4 py-3 text-xs font-bold">{formatINR(b.amount_paise)}</td>
              <td className="px-4 py-3"><PayBadge info={b.pay} /></td>
              <td className="px-5 py-3">{(() => { const p = payState(b); return p ? <span className={`inline-flex whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${p.cls}`}>{p.label}</span> : <Badge>{b.payment_status}</Badge>; })()}</td>
              <td className="px-5 py-3">
                {b.status === "pending" && b.payment_status !== "paid" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() < now
                  ? <span className="inline-flex whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">expired</span>
                  : b.status === "cancelled" && b.payment_status !== "paid" ? <span className="inline-flex whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">expired / cancelled</span>
                  : <Badge>{b.status}</Badge>}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{timeAgo(b.created_at)}</td>
              <td className="px-4 py-3 text-right text-xs">
                <span className="whitespace-nowrap font-bold text-brand">Details →</span>
              </td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
      <BookingDrawer service={service} bookingRef={openRef} onClose={() => setOpenRef(null)} onChanged={reload} />
    </>
  );
}
