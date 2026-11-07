"use client";
import Link from "next/link";
import { useState } from "react";
import { BusFront, Building2, CheckCircle2, Clock, IndianRupee, Palmtree, Plane, TrainFront, XCircle } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, StatCard, Table, Td, Toolbar, usePage } from "./ui";
import { useDebounced } from "./users";
import { RailUsage } from "./rail-usage";
import { formatINR, timeAgo } from "@/lib/utils";
import type { ServiceKey } from "@/lib/permissions";

const META: Record<ServiceKey, { title: string; icon: typeof Plane; sub: string; trip: string }> = {
  train: { title: "Train bookings", icon: TrainFront, sub: "IRCTC tickets, PNRs and refunds.", trip: "Train / Route" },
  flight: { title: "Flight bookings", icon: Plane, sub: "Domestic & international flight tickets.", trip: "Flight / Sector" },
  bus: { title: "Bus bookings", icon: BusFront, sub: "Seats booked across bus operators.", trip: "Operator / Route" },
  hotel: { title: "Hotel bookings", icon: Building2, sub: "Room nights and stays.", trip: "Hotel / City" },
  package: { title: "Package bookings", icon: Palmtree, sub: "Holiday packages and itineraries.", trip: "Package" },
};

type B = { id: number; booking_ref: string; status: string; payment_status: string; title: string; origin: string | null; destination: string | null; travel_date: string | null; travellers: number; amount_paise: number; provider: string | null; created_at: string; user_id: number; user_name: string | null; user_uid: string; provider_ref: string | null; ticket_status?: string; pay_payment_id?: string | null };

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
      <PageHeader icon={<m.icon />} title={m.title} sub={m.sub} />
      {service === "train" && <div className="mb-4"><RailUsage compact /></div>}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Confirmed" value={data?.summary.confirmed ?? "—"} icon={<CheckCircle2 />} tone="mint" />
        <StatCard label="Pending" value={data?.summary.pending ?? "—"} icon={<Clock />} tone="sky" />
        <StatCard label="Cancelled / refunded" value={data?.summary.cancelled ?? "—"} icon={<XCircle />} tone="iris" />
        <StatCard label="Revenue" value={data ? formatINR(data.summary.revenuePaise) : "—"} icon={<IndianRupee />} />
      </div>
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Booking ref, PNR / provider ref, or SKYO ID" />
          <Select value={status} onChange={setStatus} options={[["", "All statuses"], ["confirmed", "Confirmed"], ["pending", "Pending"], ["cancelled", "Cancelled"], ["failed", "Failed"], ["refunded", "Refunded"]]} />
          {service === "train" && <span className="ml-auto rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">Live IRCTC integration: coming next</span>}
        </Toolbar>
        <Table head={["Ref", m.trip, "SKYO ID", "Travel date", "Pax", "Amount", "Payment", "Status", "Booked", ""]} loading={loading} empty={!data?.bookings.length}>
          {data?.bookings.map((b) => (
            <tr key={b.id} className="hover:bg-neutral-50/70">
              <td className="px-4 py-3 font-mono text-xs font-bold">{b.booking_ref}</td>
              <td className="px-4 py-3 text-xs"><div className="font-semibold">{b.title}</div><div className="text-muted">{[b.origin, b.destination].filter(Boolean).join(" → ")}</div></td>
              <Td><Link href={`/admin/users/${b.user_id}`} className="hover:underline"><div className="font-mono text-xs">{b.user_uid}</div><div className="text-[11px] text-neutral-500">{b.user_name}</div></Link></Td>
              <td className="px-4 py-3 text-xs">{b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-IN") : "—"}</td>
              <td className="px-4 py-3 text-center text-xs">{b.travellers}</td>
              <td className="px-4 py-3 text-xs font-bold">{formatINR(b.amount_paise)}</td>
              <td className="px-5 py-3"><Badge>{b.payment_status}</Badge></td>
              <td className="px-5 py-3"><Badge>{b.status}</Badge></td>
              <td className="px-4 py-3 text-xs text-muted">{timeAgo(b.created_at)}</td>
              <td className="px-4 py-3 text-right text-xs">
                {b.ticket_status === "issued" && <a href={`/api/bookings/${b.booking_ref}/ticket`} className="font-bold text-brand hover:underline">Ticket</a>}
                <a href={`/admin/transactions?q=${b.booking_ref}`} className="ml-3 font-bold text-ink/60 hover:underline">Logs</a>
              </td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
