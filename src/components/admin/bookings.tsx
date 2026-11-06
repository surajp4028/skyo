"use client";
import Link from "next/link";
import { useState } from "react";
import { BusFront, Building2, CheckCircle2, Clock, IndianRupee, Palmtree, Plane, TrainFront, XCircle } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, StatCard, Table, usePage } from "./ui";
import { useDebounced } from "./users";
import { formatINR, timeAgo } from "@/lib/utils";
import type { ServiceKey } from "@/lib/permissions";

const META: Record<ServiceKey, { title: string; icon: typeof Plane; sub: string; trip: string }> = {
  train: { title: "Train bookings", icon: TrainFront, sub: "IRCTC tickets, PNRs and refunds.", trip: "Train / Route" },
  flight: { title: "Flight bookings", icon: Plane, sub: "Domestic & international flight tickets.", trip: "Flight / Sector" },
  bus: { title: "Bus bookings", icon: BusFront, sub: "Seats booked across bus operators.", trip: "Operator / Route" },
  hotel: { title: "Hotel bookings", icon: Building2, sub: "Room nights and stays.", trip: "Hotel / City" },
  package: { title: "Package bookings", icon: Palmtree, sub: "Holiday packages and itineraries.", trip: "Package" },
};

type B = { id: number; booking_ref: string; status: string; payment_status: string; title: string; origin: string | null; destination: string | null; travel_date: string | null; travellers: number; amount_paise: number; provider: string | null; created_at: string; user_id: number; user_name: string | null; user_uid: string };

export function BookingsView({ service }: { service: ServiceKey }) {
  const m = META[service];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${service}|${dq}|${status}`);
  const { data, loading } = useFetch<{ bookings: B[]; total: number; page: number; size: number; summary: { confirmed: number; pending: number; cancelled: number; revenuePaise: number } }>(
    `/api/admin/bookings/${service}?${new URLSearchParams({ q: dq, status, page: String(page) })}`,
  );
  return (
    <>
      <PageHeader icon={<m.icon className="h-6 w-6" />} title={m.title} sub={m.sub} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Confirmed" value={data?.summary.confirmed ?? "—"} icon={<CheckCircle2 className="h-5 w-5" />} tone="mint" />
        <StatCard label="Pending" value={data?.summary.pending ?? "—"} icon={<Clock className="h-5 w-5" />} tone="sky" />
        <StatCard label="Cancelled / refunded" value={data?.summary.cancelled ?? "—"} icon={<XCircle className="h-5 w-5" />} tone="iris" />
        <StatCard label="Revenue" value={data ? formatINR(data.summary.revenuePaise) : "—"} icon={<IndianRupee className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchBox value={q} onChange={setQ} placeholder="Booking ref, PNR or route" />
          <Select value={status} onChange={setStatus} options={[["", "All statuses"], ["confirmed", "Confirmed"], ["pending", "Pending"], ["cancelled", "Cancelled"], ["failed", "Failed"], ["refunded", "Refunded"]]} />
          {service === "train" && <span className="ml-auto rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">Live IRCTC integration: coming next</span>}
        </div>
        <Table head={["Ref", m.trip, "Traveller", "Travel date", "Pax", "Amount", "Payment", "Status", "Booked"]} loading={loading} empty={!data?.bookings.length}>
          {data?.bookings.map((b) => (
            <tr key={b.id} className="hover:bg-surface/60">
              <td className="px-5 py-3 font-mono text-xs font-bold">{b.booking_ref}</td>
              <td className="px-5 py-3 text-xs"><div className="font-semibold">{b.title}</div><div className="text-muted">{[b.origin, b.destination].filter(Boolean).join(" → ")}</div></td>
              <td className="px-5 py-3 text-xs"><Link href={`/admin/users/${b.user_id}`} className="font-semibold hover:text-brand">{b.user_name || b.user_uid}</Link></td>
              <td className="px-5 py-3 text-xs">{b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-IN") : "—"}</td>
              <td className="px-5 py-3 text-center text-xs">{b.travellers}</td>
              <td className="px-5 py-3 text-xs font-bold">{formatINR(b.amount_paise)}</td>
              <td className="px-5 py-3"><Badge>{b.payment_status}</Badge></td>
              <td className="px-5 py-3"><Badge>{b.status}</Badge></td>
              <td className="px-5 py-3 text-xs text-muted">{timeAgo(b.created_at)}</td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
