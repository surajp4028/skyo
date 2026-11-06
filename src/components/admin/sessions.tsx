"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Globe } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Table, usePage } from "./ui";
import { useAdmin } from "./admin-context";
import { useDebounced } from "./users";
import { api, errMsg } from "@/lib/client/api";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { fmtDateTime, timeAgo } from "@/lib/utils";

type S = { id: number; owner_id: number; name: string | null; contact: string | null; role: string; ip: string; location: string | null; device: string; client: string; login_method: string; created_at: string; last_seen_at: string; revoked_at: string | null; revoked_reason: string | null; active: number };

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

  const tabs = [{ value: "user" as const, label: "Customer sessions" }, ...(admin.can("staff.manage") ? [{ value: "admin" as const, label: "Agent sessions" }] : [])];

  return (
    <>
      <PageHeader icon={<Activity className="h-6 w-6" />} title="Session logs" sub="Every login with IP, approximate location, device and how it ended." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <AnimatedTabs tabs={tabs} value={kind} onChange={setKind} layoutId="sess-kind" className="rounded-full bg-surface p-1" />
          <SearchBox value={q} onChange={setQ} placeholder={kind === "user" ? "IP, UID or name" : "IP, email or name"} />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#ff5a1f]" /> Active only
          </label>
        </div>
        <Table head={[kind === "user" ? "Traveller" : "Agent", "Device", "Location / IP", "Method", "Logged in", "Last seen", "State", ""]} loading={loading} empty={!data?.sessions.length}>
          {data?.sessions.map((s) => (
            <tr key={s.id} className="hover:bg-surface/60">
              <td className="px-5 py-3">
                <div className="font-semibold">{s.name || "Unnamed"}</div>
                <div className="text-xs text-muted">{s.contact} {kind === "admin" && <Badge>{s.role}</Badge>}</div>
              </td>
              <td className="max-w-[220px] px-5 py-3 text-xs">{s.device}<div className="text-muted">{s.client}</div></td>
              <td className="px-5 py-3 text-xs"><div className="flex items-center gap-1"><Globe className="h-3 w-3 text-muted" />{s.location || "—"}</div><div className="font-mono text-muted">{s.ip}</div></td>
              <td className="px-5 py-3 text-xs">{s.login_method}</td>
              <td className="px-5 py-3 text-xs text-muted">{fmtDateTime(s.created_at)}</td>
              <td className="px-5 py-3 text-xs text-muted">{timeAgo(s.last_seen_at)}</td>
              <td className="px-5 py-3">{s.active ? <Badge>active</Badge> : <Badge tone="revoked">{s.revoked_reason || "expired"}</Badge>}</td>
              <td className="px-5 py-3 text-right">
                {!!s.active && admin.can("sessions.revoke") && (
                  <button
                    className="text-xs font-bold text-red-600 hover:underline"
                    onClick={async () => {
                      try {
                        await api("/api/admin/sessions", { body: { kind, id: s.id } });
                        toast.success("Session ended");
                        void reload();
                      } catch (e) {
                        toast.error(errMsg(e));
                      }
                    }}
                  >
                    Force logout
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
