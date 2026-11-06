"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Globe } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Avatar, Badge, Card, PageHeader, Pager, SearchBox, Table, Td, Toolbar, usePage } from "./ui";
import { useAdmin } from "./admin-context";
import { useDebounced } from "./users";
import { api, errMsg } from "@/lib/client/api";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { fmtDateTime, timeAgo } from "@/lib/utils";

type S = { id: number; owner_id: number; name: string | null; contact: string | null; ref: string; ip: string; location: string | null; device: string; client: string; login_method: string; created_at: string; last_seen_at: string; revoked_reason: string | null; active: number };

export function SessionsLog() {
  const admin = useAdmin();
  const [kind, setKind] = useState<"user" | "admin">("user");
  const [active, setActive] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${kind}|${active}|${dq}`);
  const { data, loading, reload } = useFetch<{ sessions: S[]; total: number; page: number; size: number }>(
    `/api/admin/sessions?${new URLSearchParams({ kind, active: active ? "1" : "", q: dq, page: String(page) })}`,
  );
  const tabs = [{ value: "user" as const, label: "Customers" }, ...(admin.can("staff.manage") ? [{ value: "admin" as const, label: "Agents" }] : [])];

  return (
    <>
      <PageHeader icon={<Activity />} title="Session logs" sub="Every login with IP, approximate location, device and how it ended." />
      <Card>
        <Toolbar>
          <AnimatedTabs tabs={tabs} value={kind} onChange={setKind} layoutId="sess-kind" className="rounded-lg border border-neutral-200 bg-neutral-50 p-0.5" tabClassName="rounded-md px-3 py-1.5 text-[13px]" pillClassName="rounded-md bg-white shadow-sm border border-neutral-200" activeTextClassName="text-neutral-900" />
          <SearchBox value={q} onChange={setQ} placeholder={kind === "user" ? "IP, SKYO ID, email, mobile or full name" : "IP or agent email"} />
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-neutral-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-neutral-900" /> Active only
          </label>
        </Toolbar>
        <Table head={[kind === "user" ? "Traveller" : "Agent", "Device", "Location / IP", "Method", "Logged in", "Last seen", "State", ""]} loading={loading} empty={!data?.sessions.length}>
          {data?.sessions.map((s) => (
            <tr key={s.id} className="hover:bg-neutral-50/70">
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} />
                  <div className="min-w-0">
                    {kind === "user" ? <Link href={`/admin/users/${s.owner_id}`} className="font-medium hover:underline">{s.name || "Unnamed"}</Link> : <span className="font-medium">{s.name}</span>}
                    <div className="truncate text-[11px] text-neutral-500">{kind === "user" ? <span className="font-mono">{s.ref}</span> : <Badge>{s.ref}</Badge>} {s.contact && `· ${s.contact}`}</div>
                  </div>
                </div>
              </Td>
              <Td className="max-w-[220px]"><div className="truncate">{s.device}</div><div className="text-[11px] text-neutral-400">{s.client}</div></Td>
              <Td><div className="flex items-center gap-1"><Globe className="h-3 w-3 text-neutral-400" />{s.location || "—"}</div><div className="font-mono text-[11px] text-neutral-400">{s.ip}</div></Td>
              <Td className="text-neutral-600">{s.login_method}</Td>
              <Td className="whitespace-nowrap text-neutral-500">{fmtDateTime(s.created_at)}</Td>
              <Td className="whitespace-nowrap text-neutral-500">{timeAgo(s.last_seen_at)}</Td>
              <Td>{s.active ? <Badge>active</Badge> : <Badge tone="ended">{s.revoked_reason || "expired"}</Badge>}</Td>
              <Td className="text-right">
                {!!s.active && admin.can("sessions.revoke") && (
                  <button
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      try {
                        await api("/api/admin/sessions", { body: { kind, id: s.id } });
                        toast.success("Session ended");
                        reload();
                      } catch (e) {
                        toast.error(errMsg(e));
                      }
                    }}
                  >
                    Force logout
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
