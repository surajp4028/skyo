"use client";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, Table, Toolbar, usePage } from "./ui";
import { useDebounced } from "./users";
import { fmtDateTime } from "@/lib/utils";

type L = { id: number; actor_type: string; actor_id: number | null; actor_name: string | null; action: string; target_type: string | null; target_id: string | null; ip: string | null; meta: unknown; created_at: string };

export function AuditTrail() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const da = useDebounced(action);
  const [page, setPage] = usePage(`${actor}|${da}`);
  const { data, loading } = useFetch<{ logs: L[]; total: number; page: number; size: number }>(`/api/admin/audit?${new URLSearchParams({ actor, action: da, page: String(page) })}`);
  return (
    <>
      <PageHeader icon={<ScrollText />} title="Audit trail" sub="Tamper-evident record of logins, failures, permission changes and data access." />
      <Card>
        <Toolbar>
          <SearchBox value={action} onChange={setAction} placeholder="Action prefix e.g. agent. or user.login" />
          <Select value={actor} onChange={setActor} options={[["", "All actors"], ["user", "Customers"], ["admin", "Agents"], ["system", "System"]]} />
        </Toolbar>
        <Table head={["When", "Actor", "Action", "Target", "IP", "Details"]} loading={loading} empty={!data?.logs.length}>
          {data?.logs.map((l) => (
            <tr key={l.id} className="hover:bg-neutral-50/70">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{fmtDateTime(l.created_at)}</td>
              <td className="px-4 py-3 text-xs"><Badge tone={l.actor_type === "admin" ? "staff" : undefined}>{l.actor_type}</Badge> <span className="ml-1 font-semibold">{l.actor_name}</span></td>
              <td className="px-4 py-3 font-mono text-xs font-bold">{l.action}</td>
              <td className="px-4 py-3 text-xs text-muted">{l.target_type ? `${l.target_type} #${l.target_id}` : "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{l.ip || "—"}</td>
              <td className="max-w-[280px] truncate px-4 py-3 font-mono text-[11px] text-muted">{l.meta ? (typeof l.meta === "string" ? l.meta : JSON.stringify(l.meta)) : ""}</td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
