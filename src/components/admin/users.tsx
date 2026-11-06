"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Globe, Monitor, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, Table, usePage } from "./ui";
import { useAdmin } from "./admin-context";
import { timeAgo } from "@/lib/utils";

type U = {
  id: number; uid: string; name: string | null; email: string | null; phone: string | null; email_verified_at: string | null; phone_verified_at: string | null;
  status: string; signup_method: string; last_login_at: string | null; last_login_ip: string | null; last_location: string | null; last_device: string | null; created_at: string; active_sessions: number;
};

export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function UsersList() {
  const admin = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [reveal, setReveal] = useState(false);
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${dq}|${status}`);
  const qs = new URLSearchParams({ q: dq, status, page: String(page), ...(reveal ? { reveal: "1" } : {}) });
  const { data, loading } = useFetch<{ users: U[]; total: number; page: number; size: number }>(`/api/admin/users?${qs}`);

  return (
    <>
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Users"
        sub="Every traveller account with login location, IP, device and status."
        actions={
          admin.can("users.contact") && (
            <button onClick={() => setReveal((r) => !r)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:border-ink/30">
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {reveal ? "Mask contacts" : "Reveal contacts"}
            </button>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchBox value={q} onChange={setQ} placeholder="Search name, exact email / mobile, UID or IP" />
          <Select value={status} onChange={setStatus} options={[["", "All statuses"], ["active", "Active"], ["inactive", "Inactive"], ["blocked", "Blocked"]]} />
          {reveal && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">PII visible · this view is audit-logged</span>}
        </div>
        <Table head={["User", "Contact", "Status", "Location & IP", "Device", "Sessions", "Last login", "Joined"]} loading={loading} empty={!data?.users.length}>
          {data?.users.map((u) => (
            <tr key={u.id} className="transition hover:bg-surface/60">
              <td className="px-5 py-3.5">
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-iris/20 font-bold">{(u.name || "T")[0]}</div>
                  <div>
                    <div className="font-semibold text-ink hover:text-brand">{u.name || "Unnamed"}</div>
                    <div className="font-mono text-[10px] text-muted">{u.uid}</div>
                  </div>
                </Link>
              </td>
              <td className="px-5 py-3.5 text-xs">
                <div className="font-medium">{u.email || "—"} {u.email_verified_at && <span className="text-mint">✓</span>}</div>
                <div className="text-muted">{u.phone ? `+91 ${u.phone}` : "—"} {u.phone_verified_at && <span className="text-mint">✓</span>}</div>
              </td>
              <td className="px-5 py-3.5"><Badge>{u.status}</Badge></td>
              <td className="px-5 py-3.5 text-xs">
                <div className="flex items-center gap-1 font-medium"><Globe className="h-3 w-3 text-muted" /> {u.last_location || "—"}</div>
                <div className="font-mono text-muted">{u.last_login_ip || "—"}</div>
              </td>
              <td className="max-w-[200px] px-5 py-3.5 text-xs"><div className="flex items-center gap-1 truncate"><Monitor className="h-3 w-3 shrink-0 text-muted" /> {u.last_device || "—"}</div></td>
              <td className="px-5 py-3.5 text-center font-bold">{u.active_sessions}</td>
              <td className="px-5 py-3.5 text-xs text-muted">{timeAgo(u.last_login_at)}</td>
              <td className="px-5 py-3.5 text-xs text-muted">{timeAgo(u.created_at)}</td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
