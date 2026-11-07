"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Globe, LogOut, Monitor, ShieldAlert, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Avatar, Badge, Btn, Card, PageHeader, Pager, SearchBox, Select, Table, Td, Toolbar, usePage } from "./ui";
import { useAdmin } from "./admin-context";
import { api, errMsg } from "@/lib/client/api";
import { timeAgo } from "@/lib/utils";

type U = {
  id: number; uid: string; name: string | null; email: string | null; phone: string | null; email_verified_at: string | null; phone_verified_at: string | null;
  status: string; signup_method: string; last_login_at: string | null; last_login_ip: string | null; last_location: string | null; last_device: string | null;
  created_at: string; active_sessions: number; bookings: number; avatar?: string | null;
};

export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export async function forceLogoutUser(id: number) {
  try {
    const r = await api<{ revoked: number }>(`/api/admin/users/${id}/logout`, { method: "POST" });
    toast.success(r.revoked ? `Logged out of ${r.revoked} device${r.revoked > 1 ? "s" : ""}` : "No active sessions");
  } catch (e) {
    toast.error(errMsg(e));
  }
}

export function UsersList() {
  const admin = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${dq}|${status}`);
  const { data, loading, reload } = useFetch<{ users: U[]; total: number; page: number; size: number; full: boolean }>(`/api/admin/users?${new URLSearchParams({ q: dq, status, page: String(page) })}`);

  return (
    <>
      <PageHeader
        icon={<Users />}
        title="Users"
        sub="Every traveller with SKYO ID, full contact details, login location, IP, device and status. Stored encrypted with AWS KMS."
        actions={admin.can("staff.manage") && <Btn variant="danger" onClick={() => setConfirmAll(true)}><ShieldAlert className="h-4 w-4" /> Force logout all users</Btn>}
      />
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="SKYO ID, email, mobile, IP or full name" />
          <Select value={status} onChange={setStatus} options={[["", "All statuses"], ["active", "Active"], ["inactive", "Inactive"], ["blocked", "Blocked"]]} />
          {data && !data.full && <span className="text-xs text-amber-700">Contacts masked for your role</span>}
          <span className="ml-auto text-xs text-neutral-400">{data ? `${data.total} users` : ""}</span>
        </Toolbar>
        <Table head={["User", "Email", "Mobile", "Status", "Location & IP", "Device", "Sessions", "Last login", ""]} loading={loading} empty={!data?.users.length}>
          {data?.users.map((u) => (
            <tr key={u.id} className="group transition hover:bg-neutral-50/70">
              <Td>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5">
                  <Avatar name={u.name} src={u.avatar} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900 group-hover:underline">{u.name || "Unnamed"}</div>
                    <div className="font-mono text-[11px] text-neutral-500">{u.uid}</div>
                  </div>
                </Link>
              </Td>
              <Td>{u.email ? <span>{u.email} {u.email_verified_at && <span className="text-emerald-600" title="Verified">✓</span>}</span> : <span className="text-neutral-300">—</span>}</Td>
              <Td className="whitespace-nowrap">{u.phone ? <span>+91 {u.phone} {u.phone_verified_at && <span className="text-emerald-600" title="Verified">✓</span>}</span> : <span className="text-neutral-300">—</span>}</Td>
              <Td><Badge>{u.status}</Badge></Td>
              <Td>
                <div className="flex items-center gap-1 text-neutral-700"><Globe className="h-3 w-3 text-neutral-400" /> {u.last_location || "—"}</div>
                <div className="font-mono text-[11px] text-neutral-400">{u.last_login_ip || "—"}</div>
              </Td>
              <Td className="max-w-[200px]"><div className="flex items-center gap-1 truncate text-neutral-600"><Monitor className="h-3 w-3 shrink-0 text-neutral-400" /> {u.last_device || "—"}</div></Td>
              <Td className="text-center tabular-nums">{u.active_sessions}</Td>
              <Td className="whitespace-nowrap text-neutral-500">{timeAgo(u.last_login_at)}</Td>
              <Td className="text-right">
                {admin.can("sessions.revoke") && u.active_sessions > 0 && (
                  <button
                    onClick={async () => {
                      await forceLogoutUser(u.id);
                      reload();
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 opacity-70 transition hover:bg-red-50 hover:opacity-100"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Logout
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
      <AnimatePresence>{confirmAll && <ConfirmLogoutAll onClose={() => setConfirmAll(false)} onDone={() => (setConfirmAll(false), reload())} />}</AnimatePresence>
    </>
  );
}

function ConfirmLogoutAll({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></div>
        <h3 className="mt-4 text-lg font-semibold">Log out every traveller?</h3>
        <p className="mt-1 text-sm text-neutral-500">All customer sessions on every device end immediately. They&apos;ll need an OTP to sign in again. Use this after a security incident.</p>
        <label className="mt-5 block text-xs font-medium text-neutral-600">Type <span className="font-mono font-semibold text-neutral-900">LOGOUT ALL</span> to confirm</label>
        <input value={text} onChange={(e) => setText(e.target.value)} autoFocus className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 font-mono text-sm outline-none focus:border-neutral-400" />
        <div className="mt-5 flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="dark"
            disabled={text !== "LOGOUT ALL" || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ revoked: number }>("/api/admin/users/logout-all", { body: { confirm: text } });
                toast.success(`Ended ${r.revoked} session${r.revoked === 1 ? "" : "s"}`);
                onDone();
              } catch (e) {
                toast.error(errMsg(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Force logout everyone
          </Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
